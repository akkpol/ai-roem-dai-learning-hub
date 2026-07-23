import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

import type { AppDatabase } from "@/platform/database/client";
import type { DatabaseTransaction } from "@/platform/database/transaction";
import { enqueueDomainEvent } from "@/platform/events/outbox";

import { appendIdentityAudit } from "./audit";
import {
  evaluateAuthorization,
  loadCurrentActor,
  type Actor,
  type Permission,
} from "./authorization";
import {
  type GlobalRole,
  identityAccounts,
  identityAuditEvents,
  identityGlobalRoleGrants,
  identityProfiles,
  identitySessions,
  identityTwoFactors,
} from "./schema";

type AdminCommand = {
  actor: Actor;
  targetAccountId: string;
  reasonCode: string;
  correlationId?: string;
};

type RoleCommand = AdminCommand & {
  role: GlobalRole;
  startsAt?: Date;
  expiresAt?: Date;
};

export type SupportAccountDto = {
  accountId: string;
  displayName: string;
  status: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
};

export type AdminAccountDto = SupportAccountDto & {
  email: string | null;
  createdAt: string;
  activeGlobalRoles: GlobalRole[];
};

export type IdentityAdministrationTestHooks = {
  afterLifecycleWrites?(): Promise<void>;
  afterRoleGrantWrites?(): Promise<void>;
};

function assertReasonCode(reasonCode: string): void {
  if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(reasonCode)) {
    throw new Error("invalid reason code");
  }
}

async function requireCurrentPermission(
  transaction: DatabaseTransaction,
  input: {
    actor: Actor;
    permission: Permission;
    targetAccountId?: string;
  },
): Promise<Actor> {
  const current = await loadCurrentActor(transaction, input.actor);
  if (
    !current ||
    !evaluateAuthorization({
      actor: current,
      permission: input.permission,
      targetAccountId: input.targetAccountId,
    }).allowed
  ) {
    throw new Error("permission denied");
  }
  return current;
}

async function lockTargetAccount(
  transaction: DatabaseTransaction,
  targetAccountId: string,
) {
  const rows = await transaction
    .select({
      id: identityAccounts.id,
      status: identityAccounts.status,
      emailVerified: identityAccounts.emailVerified,
      twoFactorEnabled: identityAccounts.twoFactorEnabled,
    })
    .from(identityAccounts)
    .where(eq(identityAccounts.id, targetAccountId))
    .for("update");
  if (!rows[0]) throw new Error("account unavailable");
  return rows[0];
}

async function publishLifecycleEvent(
  transaction: DatabaseTransaction,
  input: {
    eventType:
      | "identity.global_role_changed.v1"
      | "identity.account_suspended.v1"
      | "identity.account_activated.v1";
    accountId: string;
    payload: Record<string, string>;
    occurredAt: Date;
  },
) {
  await enqueueDomainEvent(transaction, {
    eventType: input.eventType,
    aggregateType: "identity_account",
    aggregateId: input.accountId,
    payload: input.payload,
    occurredAt: input.occurredAt,
  });
}

export function createIdentityAdministrationService(
  database: AppDatabase,
  testHooks?: IdentityAdministrationTestHooks,
) {
  return {
    searchAccounts: (
      actor: Actor,
      query: string,
      limit = 20,
    ): Promise<SupportAccountDto[]> =>
      database.transaction(async (transaction) => {
        await requireCurrentPermission(transaction, {
          actor,
          permission: "identity.account.search",
        });
        const normalized = query.trim().toLowerCase();
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            normalized,
          );
        const isEmail =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
          normalized.length <= 320;
        if (!isUuid && !isEmail) return [];
        return transaction
          .select({
            accountId: identityAccounts.id,
            displayName: identityProfiles.displayName,
            status: identityAccounts.status,
            emailVerified: identityAccounts.emailVerified,
            twoFactorEnabled: identityAccounts.twoFactorEnabled,
          })
          .from(identityAccounts)
          .innerJoin(
            identityProfiles,
            eq(identityProfiles.accountId, identityAccounts.id),
          )
          .where(
            isUuid
              ? eq(identityAccounts.id, normalized)
              : eq(identityAccounts.email, normalized),
          )
          .limit(Math.min(Math.max(limit, 1), 1));
      }),

    getSupportAccount: (
      actor: Actor,
      targetAccountId: string,
    ): Promise<SupportAccountDto> =>
      database.transaction(async (transaction) => {
        await requireCurrentPermission(transaction, {
          actor,
          permission: "identity.account.support.read",
          targetAccountId,
        });
        const rows = await transaction
          .select({
            accountId: identityAccounts.id,
            displayName: identityProfiles.displayName,
            status: identityAccounts.status,
            emailVerified: identityAccounts.emailVerified,
            twoFactorEnabled: identityAccounts.twoFactorEnabled,
          })
          .from(identityAccounts)
          .innerJoin(
            identityProfiles,
            eq(identityProfiles.accountId, identityAccounts.id),
          )
          .where(eq(identityAccounts.id, targetAccountId));
        if (!rows[0]) throw new Error("account unavailable");
        return rows[0];
      }),

    getAdminAccount: (
      actor: Actor,
      targetAccountId: string,
    ): Promise<AdminAccountDto> =>
      database.transaction(async (transaction) => {
        await requireCurrentPermission(transaction, {
          actor,
          permission: "identity.account.admin.read",
          targetAccountId,
        });
        const now = new Date();
        const rows = await transaction
          .select({
            accountId: identityAccounts.id,
            displayName: identityProfiles.displayName,
            email: identityAccounts.email,
            status: identityAccounts.status,
            emailVerified: identityAccounts.emailVerified,
            twoFactorEnabled: identityAccounts.twoFactorEnabled,
            createdAt: identityAccounts.createdAt,
          })
          .from(identityAccounts)
          .innerJoin(
            identityProfiles,
            eq(identityProfiles.accountId, identityAccounts.id),
          )
          .where(eq(identityAccounts.id, targetAccountId));
        const account = rows[0];
        if (!account) throw new Error("account unavailable");
        const roles = await transaction
          .select({ role: identityGlobalRoleGrants.role })
          .from(identityGlobalRoleGrants)
          .where(
            and(
              eq(identityGlobalRoleGrants.accountId, targetAccountId),
              isNull(identityGlobalRoleGrants.revokedAt),
              lte(identityGlobalRoleGrants.startsAt, now),
              or(
                isNull(identityGlobalRoleGrants.expiresAt),
                gt(identityGlobalRoleGrants.expiresAt, now),
              ),
            ),
          );
        return {
          ...account,
          createdAt: account.createdAt.toISOString(),
          activeGlobalRoles: roles.map(({ role }) => role),
        };
      }),

    getAccountAudit: (actor: Actor, targetAccountId: string, limit = 50) =>
      database.transaction(async (transaction) => {
        await requireCurrentPermission(transaction, {
          actor,
          permission: "identity.account.audit.read",
          targetAccountId,
        });
        return transaction
          .select({
            id: identityAuditEvents.id,
            action: identityAuditEvents.action,
            actorType: identityAuditEvents.actorType,
            actorAccountId: identityAuditEvents.actorAccountId,
            reasonCode: identityAuditEvents.reasonCode,
            occurredAt: identityAuditEvents.occurredAt,
          })
          .from(identityAuditEvents)
          .where(eq(identityAuditEvents.accountId, targetAccountId))
          .orderBy(desc(identityAuditEvents.occurredAt))
          .limit(Math.max(1, Math.min(limit, 100)));
      }),

    revokeAccountSessions: (command: AdminCommand) =>
      database.transaction(async (transaction) => {
        assertReasonCode(command.reasonCode);
        const current = await requireCurrentPermission(transaction, {
          actor: command.actor,
          permission: "identity.account.sessions.revoke",
          targetAccountId: command.targetAccountId,
        });
        await lockTargetAccount(transaction, command.targetAccountId);
        const revoked = await transaction
          .delete(identitySessions)
          .where(eq(identitySessions.userId, command.targetAccountId))
          .returning({ id: identitySessions.id });
        await appendIdentityAudit(transaction, {
          targetAccountId: command.targetAccountId,
          actor: { type: "account", accountId: current.accountId },
          action: "identity.sessions_revoked_by_operator.v1",
          reasonCode: command.reasonCode,
          correlationId: command.correlationId,
          payload: { revokedCount: revoked.length },
        });
        return { revokedCount: revoked.length };
      }),

    suspendAccount: (command: AdminCommand) =>
      database.transaction(async (transaction) => {
        assertReasonCode(command.reasonCode);
        const current = await requireCurrentPermission(transaction, {
          actor: command.actor,
          permission: "identity.account.suspend",
          targetAccountId: command.targetAccountId,
        });
        const target = await lockTargetAccount(
          transaction,
          command.targetAccountId,
        );
        if (target.status !== "active") throw new Error("account is not active");
        const now = new Date();
        await transaction
          .update(identityAccounts)
          .set({ status: "suspended", updatedAt: now })
          .where(eq(identityAccounts.id, target.id));
        await transaction
          .delete(identitySessions)
          .where(eq(identitySessions.userId, target.id));
        await testHooks?.afterLifecycleWrites?.();
        await appendIdentityAudit(transaction, {
          targetAccountId: target.id,
          actor: { type: "account", accountId: current.accountId },
          action: "identity.account_suspended.v1",
          reasonCode: command.reasonCode,
          correlationId: command.correlationId,
          occurredAt: now,
        });
        await publishLifecycleEvent(transaction, {
          eventType: "identity.account_suspended.v1",
          accountId: target.id,
          payload: { status: "suspended" },
          occurredAt: now,
        });
        return { status: "suspended" as const };
      }),

    reactivateAccount: (command: AdminCommand) =>
      database.transaction(async (transaction) => {
        assertReasonCode(command.reasonCode);
        const current = await requireCurrentPermission(transaction, {
          actor: command.actor,
          permission: "identity.account.reactivate",
          targetAccountId: command.targetAccountId,
        });
        const target = await lockTargetAccount(
          transaction,
          command.targetAccountId,
        );
        if (target.status !== "suspended") {
          throw new Error("account is not suspended");
        }
        const now = new Date();
        await transaction
          .update(identityAccounts)
          .set({ status: "active", updatedAt: now })
          .where(eq(identityAccounts.id, target.id));
        await appendIdentityAudit(transaction, {
          targetAccountId: target.id,
          actor: { type: "account", accountId: current.accountId },
          action: "identity.account_reactivated.v1",
          reasonCode: command.reasonCode,
          correlationId: command.correlationId,
          occurredAt: now,
        });
        await publishLifecycleEvent(transaction, {
          eventType: "identity.account_activated.v1",
          accountId: target.id,
          payload: { status: "active", source: "admin_reactivation" },
          occurredAt: now,
        });
        return { status: "active" as const };
      }),

    grantGlobalRole: (command: RoleCommand) =>
      database.transaction(async (transaction) => {
        assertReasonCode(command.reasonCode);
        const current = await requireCurrentPermission(transaction, {
          actor: command.actor,
          permission: "identity.global_role.grant",
          targetAccountId: command.targetAccountId,
        });
        const target = await lockTargetAccount(
          transaction,
          command.targetAccountId,
        );
        if (target.status !== "active" || !target.emailVerified) {
          throw new Error("role target must be active and verified");
        }
        if (command.role === "platform_admin") {
          const factors = await transaction
            .select({ id: identityTwoFactors.id })
            .from(identityTwoFactors)
            .where(
              and(
                eq(identityTwoFactors.userId, target.id),
                eq(identityTwoFactors.verified, true),
              ),
            )
            .limit(1);
          if (!target.twoFactorEnabled || factors.length === 0) {
            throw new Error("platform admin target requires two factor");
          }
        }
        const now = new Date();
        if (
          command.startsAt &&
          command.expiresAt &&
          command.expiresAt <= command.startsAt
        ) {
          throw new Error("invalid role grant timeline");
        }
        const expired = await transaction
          .update(identityGlobalRoleGrants)
          .set({
            revokedAt: now,
            revokedByAccountId: current.accountId,
          })
          .where(
            and(
              eq(identityGlobalRoleGrants.accountId, target.id),
              eq(identityGlobalRoleGrants.role, command.role),
              isNull(identityGlobalRoleGrants.revokedAt),
              lte(identityGlobalRoleGrants.expiresAt, now),
            ),
          )
          .returning({ id: identityGlobalRoleGrants.id });
        for (const grant of expired) {
          await appendIdentityAudit(transaction, {
            targetAccountId: target.id,
            actor: { type: "account", accountId: current.accountId },
            action: "identity.global_role_expired.v1",
            reasonCode: "expired_grant_replaced",
            correlationId: command.correlationId,
            payload: { role: command.role, grantId: grant.id },
            occurredAt: now,
          });
        }
        const inserted = await transaction.execute<{ id: string }>(sql`
          insert into identity_global_role_grants (
            account_id,
            role,
            granted_by_account_id,
            reason_code,
            starts_at,
            expires_at,
            granted_at
          ) values (
            ${target.id}::uuid,
            ${command.role},
            ${current.accountId}::uuid,
            ${command.reasonCode},
            ${command.startsAt ?? now}::timestamptz,
            ${command.expiresAt ?? null}::timestamptz,
            ${now}::timestamptz
          )
          returning id
        `);
        const grant = inserted.rows[0];
        if (!grant) throw new Error("role grant was not created");
        await testHooks?.afterRoleGrantWrites?.();
        await appendIdentityAudit(transaction, {
          targetAccountId: target.id,
          actor: { type: "account", accountId: current.accountId },
          action: "identity.global_role_granted.v1",
          reasonCode: command.reasonCode,
          correlationId: command.correlationId,
          payload: { role: command.role, grantId: grant.id },
          occurredAt: now,
        });
        await publishLifecycleEvent(transaction, {
          eventType: "identity.global_role_changed.v1",
          accountId: target.id,
          payload: { role: command.role, change: "granted" },
          occurredAt: now,
        });
        return { grantId: grant.id };
      }),

    revokeGlobalRole: (command: RoleCommand) =>
      database.transaction(async (transaction) => {
        assertReasonCode(command.reasonCode);
        const current = await requireCurrentPermission(transaction, {
          actor: command.actor,
          permission: "identity.global_role.revoke",
          targetAccountId: command.targetAccountId,
        });
        await lockTargetAccount(transaction, command.targetAccountId);
        const now = new Date();
        const revoked = await transaction
          .update(identityGlobalRoleGrants)
          .set({
            revokedAt: now,
            revokedByAccountId: current.accountId,
          })
          .where(
            and(
              eq(
                identityGlobalRoleGrants.accountId,
                command.targetAccountId,
              ),
              eq(identityGlobalRoleGrants.role, command.role),
              isNull(identityGlobalRoleGrants.revokedAt),
            ),
          )
          .returning({ id: identityGlobalRoleGrants.id });
        if (!revoked[0]) throw new Error("active role grant unavailable");
        await appendIdentityAudit(transaction, {
          targetAccountId: command.targetAccountId,
          actor: { type: "account", accountId: current.accountId },
          action: "identity.global_role_revoked.v1",
          reasonCode: command.reasonCode,
          correlationId: command.correlationId,
          payload: { role: command.role, grantId: revoked[0].id },
          occurredAt: now,
        });
        await publishLifecycleEvent(transaction, {
          eventType: "identity.global_role_changed.v1",
          accountId: command.targetAccountId,
          payload: { role: command.role, change: "revoked" },
          occurredAt: now,
        });
        return { grantId: revoked[0].id };
      }),
  };
}

export async function bootstrapFirstPlatformAdmin(
  database: AppDatabase,
  input: {
    accountId: string;
    confirmation: string;
  },
): Promise<{ grantId: string }> {
  if (input.confirmation !== "bootstrap-first-platform-admin") {
    throw new Error("bootstrap confirmation is required");
  }
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext('identity.admin.bootstrap'))`,
    );
    const activeAdmins = await transaction
      .select({ id: identityGlobalRoleGrants.id })
      .from(identityGlobalRoleGrants)
      .where(
        and(
          eq(identityGlobalRoleGrants.role, "platform_admin"),
          isNull(identityGlobalRoleGrants.revokedAt),
          lte(identityGlobalRoleGrants.startsAt, new Date()),
          or(
            isNull(identityGlobalRoleGrants.expiresAt),
            gt(identityGlobalRoleGrants.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1);
    if (activeAdmins.length > 0) {
      throw new Error("platform admin already exists");
    }
    const target = await lockTargetAccount(transaction, input.accountId);
    const factors = await transaction
      .select({ id: identityTwoFactors.id })
      .from(identityTwoFactors)
      .where(
        and(
          eq(identityTwoFactors.userId, target.id),
          eq(identityTwoFactors.verified, true),
        ),
      )
      .limit(1);
    if (
      target.status !== "active" ||
      !target.emailVerified ||
      !target.twoFactorEnabled ||
      factors.length === 0
    ) {
      throw new Error("bootstrap target is not eligible");
    }
    const now = new Date();
    const rows = await transaction
      .insert(identityGlobalRoleGrants)
      .values({
        accountId: target.id,
        role: "platform_admin",
        reasonCode: "first_admin_bootstrap",
        startsAt: now,
        grantedAt: now,
      })
      .returning({ id: identityGlobalRoleGrants.id });
    await appendIdentityAudit(transaction, {
      targetAccountId: target.id,
      actor: { type: "system:bootstrap" },
      action: "identity.global_role_granted.v1",
      reasonCode: "first_admin_bootstrap",
      payload: { role: "platform_admin", grantId: rows[0].id },
      occurredAt: now,
    });
    await publishLifecycleEvent(transaction, {
      eventType: "identity.global_role_changed.v1",
      accountId: target.id,
      payload: { role: "platform_admin", change: "granted" },
      occurredAt: now,
    });
    return { grantId: rows[0].id };
  });
}

export async function recoverPlatformAdminMfa(
  database: AppDatabase,
  input: {
    accountId: string;
    incidentId: string;
    environment: string;
    confirmationEnvironment: string;
    operatorEnvironment: string | undefined;
  },
): Promise<{ revokedSessions: number }> {
  if (!/^[A-Z][A-Z0-9-]{2,63}$/.test(input.incidentId)) {
    throw new Error("invalid incident id");
  }
  if (
    !["development", "test", "preview", "production"].includes(
      input.environment,
    ) ||
    input.environment !== input.confirmationEnvironment ||
    input.environment !== input.operatorEnvironment
  ) {
    throw new Error("break-glass environment confirmation does not match");
  }
  return database.transaction(async (transaction) => {
    const target = await lockTargetAccount(transaction, input.accountId);
    if (target.status !== "active") {
      throw new Error("break-glass target must be active");
    }
    const grants = await transaction
      .select({ id: identityGlobalRoleGrants.id })
      .from(identityGlobalRoleGrants)
      .where(
        and(
          eq(identityGlobalRoleGrants.accountId, target.id),
          eq(identityGlobalRoleGrants.role, "platform_admin"),
          isNull(identityGlobalRoleGrants.revokedAt),
          lte(identityGlobalRoleGrants.startsAt, new Date()),
          or(
            isNull(identityGlobalRoleGrants.expiresAt),
            gt(identityGlobalRoleGrants.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1);
    if (!grants[0]) throw new Error("target is not an active platform admin");
    const revoked = await transaction
      .delete(identitySessions)
      .where(eq(identitySessions.userId, target.id))
      .returning({ id: identitySessions.id });
    await transaction
      .delete(identityTwoFactors)
      .where(eq(identityTwoFactors.userId, target.id));
    await transaction
      .update(identityAccounts)
      .set({ twoFactorEnabled: false, updatedAt: new Date() })
      .where(eq(identityAccounts.id, target.id));
    await appendIdentityAudit(transaction, {
      targetAccountId: target.id,
      actor: { type: "system:break-glass" },
      action: "identity.admin_mfa_recovery.v1",
      reasonCode: "incident_recovery",
      payload: {
        incidentId: input.incidentId,
        environment: input.environment,
        sessionsRevoked: revoked.length,
      },
    });
    return { revokedSessions: revoked.length };
  });
}
