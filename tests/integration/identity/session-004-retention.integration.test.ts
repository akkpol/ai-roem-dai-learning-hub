import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";
import { platformEventOutbox } from "@/platform/events/schema";
import { runIdentityRetention } from "@/modules/identity/privacy";
import {
  identityAccountDeletionRequests,
  identityAccounts,
  identityAuthFactors,
  identityAuditEvents,
  identityEmailOutbox,
  identityPolicyAcceptances,
  identityProfiles,
  identitySessions,
  identityTwoFactors,
} from "@/modules/identity/schema";

let connection: DatabaseConnection;

beforeAll(() => {
  connection = createDatabaseConnection(
    readDatabaseConfig({ ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
  );
});

it("bounds history work and deletes terminal email metadata after 90 days", async () => {
  const accountId = randomUUID();
  const recentlyClosedAccountId = randomUUID();
  const now = new Date("2026-07-19T12:00:00.000Z");
  await connection.db.insert(identityAccounts).values({
    id: accountId,
    name: null,
    email: null,
    emailVerified: true,
    status: "closed",
    ageAttestedAt: new Date("2023-01-01T00:00:00.000Z"),
    closedAt: new Date("2023-01-02T00:00:00.000Z"),
  });
  await connection.db.insert(identityAccounts).values({
    id: recentlyClosedAccountId,
    name: null,
    email: null,
    emailVerified: true,
    status: "closed",
    ageAttestedAt: new Date("2023-01-01T00:00:00.000Z"),
    closedAt: now,
  });
  await connection.db.insert(identityPolicyAcceptances).values(
    ["terms-a", "terms-b", "terms-c"].map((policyVersion) => ({
      accountId,
      policyType: "terms",
      policyVersion,
      acceptedAt: new Date("2023-01-01T00:00:00.000Z"),
    })),
  );
  await connection.db.insert(identityAuditEvents).values([
    {
      accountId,
      actorAccountId: accountId,
      action: "identity.signup_requested.v1",
      payload: { source: "email_password" },
      occurredAt: new Date("2023-01-01T00:00:00.000Z"),
    },
    {
      accountId,
      actorAccountId: accountId,
      action: "identity.email_verified.v1",
      payload: { source: "email_link" },
      occurredAt: new Date("2023-01-01T00:00:00.000Z"),
    },
    {
      accountId,
      actorAccountId: accountId,
      action: "identity.password_reset_completed.v1",
      payload: { source: "email_password" },
      occurredAt: new Date("2023-01-01T00:00:00.000Z"),
    },
  ]);
  await connection.db.insert(identityAuditEvents).values({
    accountId: recentlyClosedAccountId,
    actorAccountId: recentlyClosedAccountId,
    action: "identity.account_suspended.v1",
    payload: {},
    occurredAt: new Date("2023-01-01T00:00:00.000Z"),
  });
  await connection.db.insert(identityEmailOutbox).values(
    ["sent", "dead_letter", "expired"].map((state) => ({
      accountId,
      template: "verify_email",
      recipientHash: randomUUID(),
      encryptedPayload: null,
      keyVersion: "v1",
      state,
      expiresAt: new Date("2023-01-01T00:00:00.000Z"),
      createdAt: new Date("2023-01-01T00:00:00.000Z"),
    })),
  );

  await expect(
    runIdentityRetention(connection.db, { now, dryRun: false, batchLimit: 2 }),
  ).resolves.toMatchObject({
    removedPolicyAcceptances: 2,
    anonymizedAuditEvents: 2,
    deletedEmailMetadata: 2,
  });
  await expect(
    connection.db.select().from(identityPolicyAcceptances).where(eq(identityPolicyAcceptances.accountId, accountId)),
  ).resolves.toHaveLength(1);
  await expect(
    connection.db.select().from(identityEmailOutbox).where(eq(identityEmailOutbox.accountId, accountId)),
  ).resolves.toHaveLength(1);
  const audits = await connection.db
    .select({ payload: identityAuditEvents.payload })
    .from(identityAuditEvents)
    .where(eq(identityAuditEvents.accountId, accountId));
  expect(audits.filter((event) => event.payload.retention === "anonymized")).toHaveLength(2);
  expect(
    audits.filter((event) => event.payload.retention !== "anonymized"),
  ).toHaveLength(1);
  await expect(
    connection.db
      .select({ payload: identityAuditEvents.payload })
      .from(identityAuditEvents)
      .where(eq(identityAuditEvents.accountId, recentlyClosedAccountId)),
  ).resolves.toEqual([{ payload: {} }]);
});

afterAll(async () => connection.close());

it("dry-runs then idempotently closes a due account and purges credentials", async () => {
  const accountId = randomUUID();
  const requestId = randomUUID();
  const now = new Date("2026-07-19T12:00:00.000Z");
  await connection.db.insert(identityAccounts).values({
    id: accountId,
    name: "Delete Me",
    email: `${accountId}@example.test`,
    emailVerified: true,
    status: "deletion_scheduled",
    ageAttestedAt: new Date("2026-01-01T00:00:00.000Z"),
    twoFactorEnabled: true,
  });
  await connection.db.insert(identityProfiles).values({
    accountId,
    displayName: "Delete Me",
  });
  await connection.db.insert(identityAuthFactors).values({
    id: randomUUID(),
    accountId,
    providerId: "credential",
    userId: accountId,
    password: "not-a-real-hash",
  });
  await connection.db.insert(identitySessions).values({
    id: randomUUID(),
    token: randomUUID(),
    userId: accountId,
    expiresAt: new Date("2026-07-20T00:00:00.000Z"),
  });
  await connection.db.insert(identityTwoFactors).values({
    id: randomUUID(),
    userId: accountId,
    secret: "encrypted-secret",
    backupCodes: "encrypted-codes",
    verified: true,
  });
  await connection.db.insert(identityAccountDeletionRequests).values({
    id: requestId,
    accountId,
    state: "scheduled",
    requestedAt: new Date("2026-07-11T00:00:00.000Z"),
    confirmedAt: new Date("2026-07-11T00:01:00.000Z"),
    scheduledFor: new Date("2026-07-18T00:01:00.000Z"),
  });

  await expect(
    runIdentityRetention(connection.db, { now, dryRun: true, batchLimit: 10 }),
  ).resolves.toMatchObject({ dryRun: true, completedDeletions: 1 });
  expect(
    await connection.db.select().from(identityAuthFactors).where(eq(identityAuthFactors.userId, accountId)),
  ).toHaveLength(1);

  await expect(
    runIdentityRetention(connection.db, { now, dryRun: false, batchLimit: 10 }),
  ).resolves.toMatchObject({ dryRun: false, completedDeletions: 1 });
  const closed = await connection.db
    .select({
      email: identityAccounts.email,
      name: identityAccounts.name,
      status: identityAccounts.status,
      closedAt: identityAccounts.closedAt,
    })
    .from(identityAccounts)
    .where(eq(identityAccounts.id, accountId));
  expect(closed[0]).toEqual({ email: null, name: null, status: "closed", closedAt: now });
  expect(
    await connection.db.select().from(identityAuthFactors).where(eq(identityAuthFactors.userId, accountId)),
  ).toHaveLength(0);
  expect(
    await connection.db.select().from(identitySessions).where(eq(identitySessions.userId, accountId)),
  ).toHaveLength(0);
  expect(
    await connection.db.select().from(identityTwoFactors).where(eq(identityTwoFactors.userId, accountId)),
  ).toHaveLength(0);
  expect(
    await connection.db
      .select({ eventType: platformEventOutbox.eventType })
      .from(platformEventOutbox)
      .where(eq(platformEventOutbox.aggregateId, accountId)),
  ).toContainEqual({ eventType: "identity.account_closed.v1" });

  await expect(
    runIdentityRetention(connection.db, { now, dryRun: false, batchLimit: 10 }),
  ).resolves.toMatchObject({ completedDeletions: 0 });
});
