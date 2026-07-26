import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import {
  getRuntimeDatabaseConnection,
  type AppDatabase,
} from "@/platform/database/client";
import type { DatabaseTransaction } from "@/platform/database/transaction";
import {
  emitStructuredTelemetry,
  type Telemetry,
} from "@/platform/observability/telemetry";

import { createTransactionAuth } from "./auth";
import { readIdentityConfig, type IdentityConfig } from "./config";
import {
  type GlobalRole,
  identityAccounts,
  identityGlobalRoleGrants,
  identitySessions,
} from "./schema";

export type Actor = {
  accountId: string;
  accountStatus: string;
  emailVerified: boolean;
  sessionId: string;
  sessionFresh: boolean;
  mfaState: "not_enabled" | "required" | "verified";
  globalRoles: GlobalRole[];
};

export const permissionValues = [
  "identity.profile.read",
  "identity.profile.update",
  "identity.security.manage",
  "identity.sessions.manage",
  "identity.export.create",
  "identity.deletion.manage",
  "identity.account.search",
  "identity.account.support.read",
  "identity.account.admin.read",
  "identity.account.audit.read",
  "identity.account.sessions.revoke",
  "identity.account.suspend",
  "identity.account.reactivate",
  "identity.global_role.grant",
  "identity.global_role.revoke",
] as const;

export type Permission = (typeof permissionValues)[number];

export type AuthorizationReason =
  | "allowed"
  | "account_inactive"
  | "resource_ownership_required"
  | "fresh_session_required"
  | "mfa_required"
  | "self_mutation_forbidden"
  | "permission_denied";

export type AuthorizationDecision = {
  allowed: boolean;
  reason: AuthorizationReason;
};

export type AuthorizationInput = {
  actor: Actor;
  permission: Permission;
  targetAccountId?: string;
};

const ownPermissions = new Set<Permission>([
  "identity.profile.read",
  "identity.profile.update",
  "identity.security.manage",
  "identity.sessions.manage",
  "identity.export.create",
  "identity.deletion.manage",
]);

const ownStepUpPermissions = new Set<Permission>([
  "identity.security.manage",
  "identity.export.create",
  "identity.deletion.manage",
]);

const supportPermissions = new Set<Permission>([
  "identity.account.support.read",
  "identity.account.sessions.revoke",
]);

const adminPermissions = new Set<Permission>([
  "identity.account.search",
  "identity.account.admin.read",
  "identity.account.audit.read",
  "identity.account.suspend",
  "identity.account.reactivate",
  "identity.global_role.grant",
  "identity.global_role.revoke",
]);

const selfMutationPermissions = new Set<Permission>([
  "identity.account.sessions.revoke",
  "identity.account.suspend",
  "identity.account.reactivate",
  "identity.global_role.grant",
  "identity.global_role.revoke",
]);

const deny = (reason: AuthorizationReason): AuthorizationDecision => ({
  allowed: false,
  reason,
});

export function evaluateAuthorization(
  input: AuthorizationInput,
): AuthorizationDecision {
  const { actor, permission, targetAccountId } = input;
  if (actor.accountStatus !== "active" || !actor.emailVerified) {
    return deny("account_inactive");
  }

  if (ownPermissions.has(permission)) {
    if (targetAccountId !== actor.accountId) {
      return deny("resource_ownership_required");
    }
    if (ownStepUpPermissions.has(permission)) {
      if (!actor.sessionFresh) return deny("fresh_session_required");
      if (actor.mfaState === "required") return deny("mfa_required");
    }
    return { allowed: true, reason: "allowed" };
  }

  const allowedByRole =
    (actor.globalRoles.includes("support_operator") &&
      supportPermissions.has(permission)) ||
    (actor.globalRoles.includes("platform_admin") &&
      adminPermissions.has(permission));
  if (!allowedByRole) return deny("permission_denied");
  if (!actor.sessionFresh) return deny("fresh_session_required");
  if (actor.mfaState !== "verified") return deny("mfa_required");
  if (
    targetAccountId === actor.accountId &&
    selfMutationPermissions.has(permission)
  ) {
    return deny("self_mutation_forbidden");
  }
  return { allowed: true, reason: "allowed" };
}

const inertCallbacks = {
  sendVerificationEmail: async () => undefined,
  sendResetPassword: async () => undefined,
};

export async function loadCurrentActor(
  transaction: DatabaseTransaction,
  identity: { accountId: string; sessionId: string },
  now = new Date(),
): Promise<Actor | null> {
  const rows = await transaction
    .select({
      accountId: identityAccounts.id,
      accountStatus: identityAccounts.status,
      emailVerified: identityAccounts.emailVerified,
      twoFactorEnabled: identityAccounts.twoFactorEnabled,
      sessionId: identitySessions.id,
      sessionCreatedAt: identitySessions.createdAt,
      mfaVerifiedAt: identitySessions.mfaVerifiedAt,
    })
    .from(identityAccounts)
    .innerJoin(
      identitySessions,
      and(
        eq(identitySessions.userId, identityAccounts.id),
        eq(identitySessions.id, identity.sessionId),
        gt(identitySessions.expiresAt, now),
      ),
    )
    .where(eq(identityAccounts.id, identity.accountId));
  const current = rows[0];
  if (!current) return null;

  const roles = await transaction
    .select({ role: identityGlobalRoleGrants.role })
    .from(identityGlobalRoleGrants)
    .where(
      and(
        eq(identityGlobalRoleGrants.accountId, identity.accountId),
        isNull(identityGlobalRoleGrants.revokedAt),
        lte(identityGlobalRoleGrants.startsAt, now),
        or(
          isNull(identityGlobalRoleGrants.expiresAt),
          gt(identityGlobalRoleGrants.expiresAt, now),
        ),
      ),
    );
  return {
    accountId: current.accountId,
    accountStatus: current.accountStatus,
    emailVerified: current.emailVerified,
    sessionId: current.sessionId,
    sessionFresh: (() => {
      const proofAt =
        current.mfaVerifiedAt &&
        current.mfaVerifiedAt > current.sessionCreatedAt
          ? current.mfaVerifiedAt
          : current.sessionCreatedAt;
      return (
        now.getTime() >= proofAt.getTime() &&
        now.getTime() - proofAt.getTime() <= 10 * 60_000
      );
    })(),
    mfaState: !current.twoFactorEnabled
      ? "not_enabled"
      : current.mfaVerifiedAt
        ? "verified"
        : "required",
    globalRoles: roles.map(({ role }) => role),
  };
}

export function createIdentityAuthorizationService(
  database: AppDatabase,
  config: IdentityConfig,
  telemetry?: Telemetry,
) {
  const recordDenied = (
    input: AuthorizationInput,
    decision: AuthorizationDecision,
  ) => {
    if (!decision.allowed) {
      telemetry?.("identity.authorization.denied", {
        action: input.permission,
        reason: decision.reason,
        count: 1,
      });
    }
    return decision;
  };
  return {
    authenticateRequest: (request: Request): Promise<Actor | null> =>
      database.transaction(async (transaction) => {
        const auth = createTransactionAuth(transaction, config, inertCallbacks);
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return null;
        return loadCurrentActor(transaction, {
          accountId: session.user.id,
          sessionId: session.session.id,
        });
      }),

    requireActor: async (request: Request): Promise<Actor> => {
      const actor = await database.transaction(async (transaction) => {
        const auth = createTransactionAuth(transaction, config, inertCallbacks);
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return null;
        return loadCurrentActor(transaction, {
          accountId: session.user.id,
          sessionId: session.session.id,
        });
      });
      if (!actor || actor.accountStatus !== "active") {
        throw new Error("authentication required");
      }
      return actor;
    },

    authorize: (input: AuthorizationInput): Promise<AuthorizationDecision> =>
      database.transaction(async (transaction) => {
        const current = await loadCurrentActor(transaction, input.actor);
        const decision = !current
          ? deny("account_inactive")
          : evaluateAuthorization({ ...input, actor: current });
        return recordDenied(input, decision);
      }),

    requirePermission: async (input: AuthorizationInput): Promise<void> => {
      const decision = await database.transaction(async (transaction) => {
        const current = await loadCurrentActor(transaction, input.actor);
        const decision = !current
          ? deny("account_inactive")
          : evaluateAuthorization({ ...input, actor: current });
        return recordDenied(input, decision);
      });
      if (!decision.allowed) throw new Error("permission denied");
    },
  };
}

function runtimeService() {
  const { db } = getRuntimeDatabaseConnection();
  return createIdentityAuthorizationService(
    db,
    readIdentityConfig(process.env),
    emitStructuredTelemetry,
  );
}

export function authenticateRequest(request: Request): Promise<Actor | null> {
  return runtimeService().authenticateRequest(request);
}

export function requireActor(request: Request): Promise<Actor> {
  return runtimeService().requireActor(request);
}

export function authorize(
  input: AuthorizationInput,
): Promise<AuthorizationDecision> {
  return runtimeService().authorize(input);
}

export function requirePermission(input: AuthorizationInput): Promise<void> {
  return runtimeService().requirePermission(input);
}
