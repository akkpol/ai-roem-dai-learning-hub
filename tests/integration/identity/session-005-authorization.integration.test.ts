import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import {
  bootstrapFirstPlatformAdmin,
  createIdentityAdministrationService,
  recoverPlatformAdminMfa,
} from "@/modules/identity/administration";
import type { Actor } from "@/modules/identity/authorization";
import {
  identityAccounts,
  identityAuditEvents,
  identityGlobalRoleGrants,
  identityProfiles,
  identitySessions,
  identityTwoFactors,
} from "@/modules/identity/schema";
import {
  createDatabaseConnection,
  type DatabaseConnection,
} from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";

let connection: DatabaseConnection;

beforeAll(() => {
  connection = createDatabaseConnection(readDatabaseConfig(process.env));
});

afterAll(async () => connection.close());

async function seedAccount(input: {
  role?: "platform_admin" | "support_operator";
  status?: "active" | "suspended";
  twoFactor?: boolean;
}) {
  const accountId = randomUUID();
  const sessionId = randomUUID();
  await connection.db.insert(identityAccounts).values({
    id: accountId,
    name: "SESSION-005 test",
    email: `${accountId}@example.test`,
    emailVerified: true,
    status: input.status ?? "active",
    ageAttestedAt: new Date("2026-01-01T00:00:00.000Z"),
    twoFactorEnabled: input.twoFactor ?? true,
  });
  await connection.db.insert(identitySessions).values({
    id: sessionId,
    token: randomUUID(),
    userId: accountId,
    expiresAt: new Date(Date.now() + 60_000),
    mfaVerifiedAt: (input.twoFactor ?? true) ? new Date() : null,
  });
  if (input.twoFactor ?? true) {
    await connection.db.insert(identityTwoFactors).values({
      id: randomUUID(),
      userId: accountId,
      secret: "encrypted-test-secret",
      backupCodes: "encrypted-test-codes",
      verified: true,
    });
  }
  await connection.db.insert(identityProfiles).values({
    accountId,
    displayName: "SESSION-005 test",
  });
  if (input.role) {
    await connection.db.insert(identityGlobalRoleGrants).values({
      accountId,
      role: input.role,
      reasonCode: "integration_seed",
    });
  }
  return { accountId, sessionId };
}

function actor(accountId: string, sessionId: string): Actor {
  return {
    accountId,
    accountStatus: "active",
    emailVerified: true,
    sessionId,
    sessionFresh: true,
    mfaState: "verified",
    globalRoles: ["platform_admin"],
  };
}

it("serializes first-admin bootstrap and creates exactly one grant", async () => {
  const target = await seedAccount({ twoFactor: true });
  const command = {
    accountId: target.accountId,
    confirmation: "bootstrap-first-platform-admin",
  };
  const results = await Promise.allSettled([
    bootstrapFirstPlatformAdmin(connection.db, command),
    bootstrapFirstPlatformAdmin(connection.db, command),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  await expect(
    connection.db
      .select({ id: identityGlobalRoleGrants.id })
      .from(identityGlobalRoleGrants)
      .where(
        and(
          eq(identityGlobalRoleGrants.accountId, target.accountId),
          eq(identityGlobalRoleGrants.role, "platform_admin"),
        ),
      ),
  ).resolves.toHaveLength(1);
});

it("serializes concurrent role grants to one active grant", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  const target = await seedAccount({ twoFactor: true });
  const service = createIdentityAdministrationService(connection.db);
  const command = {
    actor: actor(admin.accountId, admin.sessionId),
    targetAccountId: target.accountId,
    role: "support_operator" as const,
    reasonCode: "support_rotation",
  };

  const results = await Promise.allSettled([
    service.grantGlobalRole(command),
    service.grantGlobalRole(command),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  await expect(
    connection.db
      .select({ id: identityGlobalRoleGrants.id })
      .from(identityGlobalRoleGrants)
      .where(eq(identityGlobalRoleGrants.accountId, target.accountId)),
  ).resolves.toHaveLength(1);
});

it("replaces an expired unrevoked grant without leaving stale access", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  const target = await seedAccount({ twoFactor: true });
  await connection.db.insert(identityGlobalRoleGrants).values({
    accountId: target.accountId,
    role: "support_operator",
    grantedByAccountId: admin.accountId,
    reasonCode: "temporary_support",
    startsAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
    expiresAt: new Date(Date.now() - 24 * 60 * 60_000),
  });
  const service = createIdentityAdministrationService(connection.db);
  await service.grantGlobalRole({
    actor: actor(admin.accountId, admin.sessionId),
    targetAccountId: target.accountId,
    role: "support_operator",
    reasonCode: "support_rotation",
  });
  const grants = await connection.db
    .select({ revokedAt: identityGlobalRoleGrants.revokedAt })
    .from(identityGlobalRoleGrants)
    .where(eq(identityGlobalRoleGrants.accountId, target.accountId));
  expect(grants).toHaveLength(2);
  expect(grants.filter(({ revokedAt }) => revokedAt === null)).toHaveLength(1);
});

it("invalidates stale role, status, and session state from the database", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  const target = await seedAccount({});
  const service = createIdentityAdministrationService(connection.db);
  const stale = actor(admin.accountId, admin.sessionId);

  await connection.db
    .update(identityGlobalRoleGrants)
    .set({ revokedAt: new Date(), revokedByAccountId: target.accountId })
    .where(eq(identityGlobalRoleGrants.accountId, admin.accountId));
  await expect(
    service.suspendAccount({
      actor: stale,
      targetAccountId: target.accountId,
      reasonCode: "security_review",
    }),
  ).rejects.toThrow("permission denied");

  await connection.db.insert(identityGlobalRoleGrants).values({
    accountId: admin.accountId,
    role: "platform_admin",
    reasonCode: "restore_for_test",
  });
  await connection.db
    .update(identityAccounts)
    .set({ status: "suspended" })
    .where(eq(identityAccounts.id, admin.accountId));
  await expect(
    service.suspendAccount({
      actor: stale,
      targetAccountId: target.accountId,
      reasonCode: "security_review",
    }),
  ).rejects.toThrow("permission denied");

  await connection.db
    .update(identityAccounts)
    .set({ status: "active" })
    .where(eq(identityAccounts.id, admin.accountId));
  await connection.db
    .delete(identitySessions)
    .where(eq(identitySessions.id, admin.sessionId));
  await expect(
    service.suspendAccount({
      actor: stale,
      targetAccountId: target.accountId,
      reasonCode: "security_review",
    }),
  ).rejects.toThrow("permission denied");
});

it("requires MFA proof on the exact privileged session, not merely an enrolled factor", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  const target = await seedAccount({});
  await connection.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: null })
    .where(eq(identitySessions.id, admin.sessionId));
  const service = createIdentityAdministrationService(connection.db);
  await expect(
    service.suspendAccount({
      actor: actor(admin.accountId, admin.sessionId),
      targetAccountId: target.accountId,
      reasonCode: "security_review",
    }),
  ).rejects.toThrow("permission denied");
});

it("searches only by exact UUID or normalized email", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  const target = await seedAccount({});
  const service = createIdentityAdministrationService(connection.db);
  const current = actor(admin.accountId, admin.sessionId);
  await expect(service.searchAccounts(current, target.accountId.slice(0, 8))).resolves.toEqual([]);
  await expect(
    service.searchAccounts(current, `${target.accountId.toUpperCase()}@EXAMPLE.TEST`),
  ).resolves.toEqual([
    expect.objectContaining({ accountId: target.accountId }),
  ]);
});

it("suspends account, revokes all sessions, and appends audit atomically", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  const target = await seedAccount({});
  const service = createIdentityAdministrationService(connection.db);

  await service.suspendAccount({
    actor: actor(admin.accountId, admin.sessionId),
    targetAccountId: target.accountId,
    reasonCode: "policy_violation",
  });
  await expect(
    connection.db
      .select({ status: identityAccounts.status })
      .from(identityAccounts)
      .where(eq(identityAccounts.id, target.accountId)),
  ).resolves.toEqual([{ status: "suspended" }]);
  await expect(
    connection.db
      .select({ id: identitySessions.id })
      .from(identitySessions)
      .where(eq(identitySessions.userId, target.accountId)),
  ).resolves.toHaveLength(0);
  await expect(
    connection.db
      .select({
        action: identityAuditEvents.action,
        actorAccountId: identityAuditEvents.actorAccountId,
        reasonCode: identityAuditEvents.reasonCode,
      })
      .from(identityAuditEvents)
      .where(eq(identityAuditEvents.accountId, target.accountId)),
  ).resolves.toContainEqual({
    action: "identity.account_suspended.v1",
    actorAccountId: admin.accountId,
    reasonCode: "policy_violation",
  });
});

it("rolls back status and session revocation when lifecycle audit/event work fails", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  const target = await seedAccount({});
  const service = createIdentityAdministrationService(connection.db, {
    afterLifecycleWrites: async () => {
      throw new Error("forced lifecycle failure");
    },
  });
  await expect(
    service.suspendAccount({
      actor: actor(admin.accountId, admin.sessionId),
      targetAccountId: target.accountId,
      reasonCode: "security_review",
    }),
  ).rejects.toThrow("forced lifecycle failure");
  await expect(
    connection.db
      .select({ status: identityAccounts.status })
      .from(identityAccounts)
      .where(eq(identityAccounts.id, target.accountId)),
  ).resolves.toEqual([{ status: "active" }]);
  await expect(
    connection.db
      .select({ id: identitySessions.id })
      .from(identitySessions)
      .where(eq(identitySessions.id, target.sessionId)),
  ).resolves.toHaveLength(1);
});

it("break-glass keeps role and active status while revoking sessions and MFA", async () => {
  const admin = await seedAccount({ role: "platform_admin" });
  await recoverPlatformAdminMfa(connection.db, {
    accountId: admin.accountId,
    incidentId: "INC-SESSION005",
    environment: "test",
    confirmationEnvironment: "test",
    operatorEnvironment: "test",
  });
  await expect(
    connection.db
      .select({
        status: identityAccounts.status,
        twoFactorEnabled: identityAccounts.twoFactorEnabled,
      })
      .from(identityAccounts)
      .where(eq(identityAccounts.id, admin.accountId)),
  ).resolves.toEqual([{ status: "active", twoFactorEnabled: false }]);
  await expect(
    connection.db
      .select({ id: identityGlobalRoleGrants.id })
      .from(identityGlobalRoleGrants)
      .where(
        and(
          eq(identityGlobalRoleGrants.accountId, admin.accountId),
          eq(identityGlobalRoleGrants.role, "platform_admin"),
        ),
      ),
  ).resolves.toHaveLength(1);
  await expect(
    connection.db
      .select({ id: identitySessions.id })
      .from(identitySessions)
      .where(eq(identitySessions.userId, admin.accountId)),
  ).resolves.toHaveLength(0);
  await expect(
    connection.db
      .select({ actorType: identityAuditEvents.actorType })
      .from(identityAuditEvents)
      .where(eq(identityAuditEvents.accountId, admin.accountId)),
  ).resolves.toContainEqual({ actorType: "system:break-glass" });
});
