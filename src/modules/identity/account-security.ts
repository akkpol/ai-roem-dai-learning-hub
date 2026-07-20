import { and, desc, eq, ne } from "drizzle-orm";

import type { AppDatabase } from "@/platform/database/client";

import { createTransactionAuth } from "./auth";
import type { IdentityConfig } from "./config";
import type { ProfileUpdate, SecondFactorProof } from "./account-contracts";
import {
  identityAccounts,
  identityAuditEvents,
  identityPolicyAcceptances,
  identityProfiles,
  identitySessions,
} from "./schema";

const freshSessionMilliseconds = 10 * 60 * 1_000;

type SessionRow = {
  id: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type DeviceSessionDto = {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export function assertFreshSession(createdAt: Date, now = new Date()): void {
  const age = now.getTime() - createdAt.getTime();
  if (age < 0 || age > freshSessionMilliseconds) {
    throw new Error("fresh session required");
  }
}

export function toDeviceSessionDto(
  session: SessionRow,
  currentSessionId: string,
): DeviceSessionDto {
  return {
    id: session.id,
    current: session.id === currentSessionId,
    createdAt: session.createdAt.toISOString(),
    lastSeenAt: session.updatedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    ipAddress: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
  };
}

function inertCallbacks() {
  return {
    sendVerificationEmail: async () => undefined,
    sendResetPassword: async () => undefined,
  };
}

export async function verifySecondFactor(
  auth: ReturnType<typeof createTransactionAuth>,
  headers: Headers,
  proof: SecondFactorProof,
): Promise<void> {
  if (proof.kind === "totp") {
    await auth.api.verifyTOTP({
      body: { code: proof.code, trustDevice: false },
      headers,
    });
    return;
  }
  await auth.api.verifyBackupCode({
    body: {
      code: proof.code,
      disableSession: true,
      trustDevice: false,
    },
    headers,
  });
}

export function createAccountSecurityService(
  database: AppDatabase,
  config: IdentityConfig,
) {
  const authenticate = async (
    transaction: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
    headers: Headers,
    fresh = false,
  ) => {
    const auth = createTransactionAuth(transaction, config, inertCallbacks());
    const current = await auth.api.getSession({ headers });
    if (!current) throw new Error("authentication required");
    const rows = await transaction
      .select({
        status: identityAccounts.status,
        twoFactorEnabled: identityAccounts.twoFactorEnabled,
      })
      .from(identityAccounts)
      .where(eq(identityAccounts.id, current.user.id));
    const account = rows[0];
    if (!account || account.status !== "active") {
      throw new Error("active account required");
    }
    if (fresh) assertFreshSession(current.session.createdAt);
    return { auth, current, account };
  };

  return {
    getOwnProfile: (headers: Headers) =>
      database.transaction(async (transaction) => {
        const { current } = await authenticate(transaction, headers);
        const rows = await transaction
          .select({
            displayName: identityProfiles.displayName,
            locale: identityProfiles.locale,
            timeZone: identityProfiles.timeZone,
            updatedAt: identityProfiles.updatedAt,
          })
          .from(identityProfiles)
          .where(eq(identityProfiles.accountId, current.user.id));
        if (!rows[0]) throw new Error("profile unavailable");
        return { ...rows[0], updatedAt: rows[0].updatedAt.toISOString() };
      }),

    updateOwnProfile: (headers: Headers, command: ProfileUpdate) =>
      database.transaction(async (transaction) => {
        const { current } = await authenticate(transaction, headers);
        const now = new Date();
        await transaction
          .update(identityProfiles)
          .set({ ...command, updatedAt: now })
          .where(eq(identityProfiles.accountId, current.user.id));
        await transaction
          .update(identityAccounts)
          .set({ name: command.displayName, updatedAt: now })
          .where(eq(identityAccounts.id, current.user.id));
        await transaction.insert(identityAuditEvents).values({
          accountId: current.user.id,
          action: "identity.profile_updated.v1",
          payload: { fields: "display_name,locale,time_zone" },
          occurredAt: now,
        });
        return { status: true as const };
      }),

    listPolicyHistory: (headers: Headers) =>
      database.transaction(async (transaction) => {
        const { current } = await authenticate(transaction, headers);
        const rows = await transaction
          .select({
            type: identityPolicyAcceptances.policyType,
            version: identityPolicyAcceptances.policyVersion,
            acceptedAt: identityPolicyAcceptances.acceptedAt,
          })
          .from(identityPolicyAcceptances)
          .where(eq(identityPolicyAcceptances.accountId, current.user.id))
          .orderBy(desc(identityPolicyAcceptances.acceptedAt));
        return rows.map((row) => ({
          ...row,
          acceptedAt: row.acceptedAt.toISOString(),
        }));
      }),

    listDeviceSessions: (headers: Headers) =>
      database.transaction(async (transaction) => {
        const { auth, current } = await authenticate(transaction, headers);
        const sessions = await auth.api.listSessions({ headers });
        return sessions.map((session) =>
          toDeviceSessionDto(session, current.session.id),
        );
      }),

    revokeDeviceSession: (headers: Headers, sessionId: string) =>
      database.transaction(async (transaction) => {
        const { auth, current } = await authenticate(transaction, headers);
        if (sessionId === current.session.id) {
          throw new Error("current session cannot be revoked here");
        }
        const rows = await transaction
          .select({ token: identitySessions.token })
          .from(identitySessions)
          .where(
            and(
              eq(identitySessions.id, sessionId),
              eq(identitySessions.userId, current.user.id),
              ne(identitySessions.id, current.session.id),
            ),
          );
        if (rows[0]) {
          await auth.api.revokeSession({ body: { token: rows[0].token }, headers });
          await transaction.insert(identityAuditEvents).values({
            accountId: current.user.id,
            action: "identity.session_revoked.v1",
            payload: { scope: "single_device" },
            occurredAt: new Date(),
          });
        }
        return { status: true as const };
      }),

    revokeOtherSessions: (headers: Headers) =>
      database.transaction(async (transaction) => {
        const { auth, current } = await authenticate(transaction, headers, true);
        await auth.api.revokeOtherSessions({ headers });
        await transaction.insert(identityAuditEvents).values({
          accountId: current.user.id,
          action: "identity.sessions_revoked.v1",
          payload: { scope: "all_other" },
          occurredAt: new Date(),
        });
        return { status: true as const };
      }),

    changePassword: (
      headers: Headers,
      command: { currentPassword: string; newPassword: string },
    ) =>
      database.transaction(async (transaction) => {
        const { auth, current } = await authenticate(transaction, headers, true);
        const result = await auth.api.changePassword({
          body: { ...command, revokeOtherSessions: true },
          headers,
          returnHeaders: true,
        });
        await transaction.insert(identityAuditEvents).values({
          accountId: current.user.id,
          action: "identity.password_changed.v1",
          payload: { sessions: "other_revoked" },
          occurredAt: new Date(),
        });
        return { status: true as const, headers: result.headers };
      }),

    beginTwoFactorEnrollment: (headers: Headers, password: string) =>
      database.transaction(async (transaction) => {
        const { auth } = await authenticate(transaction, headers, true);
        return auth.api.enableTwoFactor({ body: { password }, headers });
      }),

    confirmTwoFactorEnrollment: (headers: Headers, code: string) =>
      database.transaction(async (transaction) => {
        const { auth, current } = await authenticate(transaction, headers, true);
        const result = await auth.api.verifyTOTP({
          body: { code, trustDevice: false },
          headers,
          returnHeaders: true,
        });
        await transaction.insert(identityAuditEvents).values({
          accountId: current.user.id,
          action: "identity.two_factor_enabled.v1",
          payload: { method: "totp" },
          occurredAt: new Date(),
        });
        return { data: result.response, headers: result.headers };
      }),

    regenerateRecoveryCodes: (headers: Headers, password: string) =>
      database.transaction(async (transaction) => {
        const { auth } = await authenticate(transaction, headers, true);
        return auth.api.generateBackupCodes({ body: { password }, headers });
      }),

    disableTwoFactor: (
      headers: Headers,
      password: string,
      proof: SecondFactorProof,
    ) =>
      database.transaction(async (transaction) => {
        const { auth, current, account } = await authenticate(
          transaction,
          headers,
          true,
        );
        if (!account.twoFactorEnabled) throw new Error("two factor is not enabled");
        await auth.api.verifyPassword({ body: { password }, headers });
        await verifySecondFactor(auth, headers, proof);
        const result = await auth.api.disableTwoFactor({ body: { password }, headers });
        await transaction.insert(identityAuditEvents).values({
          accountId: current.user.id,
          action: "identity.two_factor_disabled.v1",
          payload: { method: proof.kind },
          occurredAt: new Date(),
        });
        return result;
      }),

    verifySignInSecondFactor: (headers: Headers, proof: SecondFactorProof) =>
      database.transaction(async (transaction) => {
        const auth = createTransactionAuth(transaction, config, inertCallbacks());
        if (proof.kind === "totp") {
          const result = await auth.api.verifyTOTP({
            body: { code: proof.code, trustDevice: false },
            headers,
            returnHeaders: true,
          });
          return { status: true as const, headers: result.headers };
        }
        const result = await auth.api.verifyBackupCode({
          body: {
            code: proof.code,
            disableSession: false,
            trustDevice: false,
          },
          headers,
          returnHeaders: true,
        });
        return { status: true as const, headers: result.headers };
      }),
  };
}
