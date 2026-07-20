import { createHmac, randomBytes } from "node:crypto";

import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";

import type { AppDatabase } from "@/platform/database/client";
import { enqueueDomainEvent } from "@/platform/events";

import { createTransactionAuth } from "./auth";
import type { IdentityConfig } from "./config";
import type { SecondFactorProof } from "./account-contracts";
import { assertFreshSession, verifySecondFactor } from "./account-security";
import { enqueueAuthEmail } from "./email/outbox";
import {
  identityAccountDeletionRequests,
  identityAccounts,
  identityAuditEvents,
  identityAuthFactors,
  identityEmailOutbox,
  identityPolicyAcceptances,
  identityProfiles,
  identityRateLimits,
  identitySessions,
  identityTwoFactors,
  identityVerifications,
} from "./schema";

export function hashDeletionToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token, "utf8").digest("hex");
}

export function retentionCutoffs(now = new Date()) {
  const transient = new Date(now);
  transient.setUTCDate(transient.getUTCDate() - 1);
  const delivery = new Date(now);
  delivery.setUTCDate(delivery.getUTCDate() - 90);
  const identityHistory = new Date(now);
  identityHistory.setUTCFullYear(identityHistory.getUTCFullYear() - 2);
  return { transient, delivery, identityHistory };
}

function inertCallbacks() {
  return {
    sendVerificationEmail: async () => undefined,
    sendResetPassword: async () => undefined,
  };
}

export function createIdentityPrivacyService(
  database: AppDatabase,
  config: IdentityConfig,
  testHooks?: {
    afterDeletionScheduledWrites?(): Promise<void>;
  },
) {
  if (testHooks && process.env.NODE_ENV !== "test") {
    throw new Error("identity privacy test hooks are unavailable");
  }
  const requireActive = async (
    transaction: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
    headers: Headers,
    fresh = false,
  ) => {
    const auth = createTransactionAuth(transaction, config, inertCallbacks());
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("authentication required");
    const accounts = await transaction
      .select({
        id: identityAccounts.id,
        email: identityAccounts.email,
        status: identityAccounts.status,
        twoFactorEnabled: identityAccounts.twoFactorEnabled,
      })
      .from(identityAccounts)
      .where(eq(identityAccounts.id, session.user.id));
    const account = accounts[0];
    if (!account || account.status !== "active" || !account.email) {
      throw new Error("active account required");
    }
    if (fresh) assertFreshSession(session.session.createdAt);
    return { auth, session, account };
  };

  const confirmSecureAction = async (
    transaction: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
    headers: Headers,
    password: string,
    proof?: SecondFactorProof,
  ) => {
    const context = await requireActive(transaction, headers, true);
    await context.auth.api.verifyPassword({ body: { password }, headers });
    if (context.account.twoFactorEnabled) {
      if (!proof) throw new Error("second factor required");
      await verifySecondFactor(context.auth, headers, proof);
    }
    return context;
  };

  return {
    exportOwnIdentity: (headers: Headers, proof?: SecondFactorProof) =>
      database.transaction(async (transaction) => {
        const { account, session } = await requireActive(transaction, headers, true);
        if (account.twoFactorEnabled) {
          if (!proof) throw new Error("second factor required");
          await verifySecondFactor(
            createTransactionAuth(transaction, config, inertCallbacks()),
            headers,
            proof,
          );
        }
        const profiles = await transaction
          .select({
            displayName: identityProfiles.displayName,
            locale: identityProfiles.locale,
            timeZone: identityProfiles.timeZone,
            createdAt: identityProfiles.createdAt,
            updatedAt: identityProfiles.updatedAt,
          })
          .from(identityProfiles)
          .where(eq(identityProfiles.accountId, account.id));
        const policies = await transaction
          .select({
            type: identityPolicyAcceptances.policyType,
            version: identityPolicyAcceptances.policyVersion,
            acceptedAt: identityPolicyAcceptances.acceptedAt,
          })
          .from(identityPolicyAcceptances)
          .where(eq(identityPolicyAcceptances.accountId, account.id))
          .orderBy(asc(identityPolicyAcceptances.acceptedAt));
        const audits = await transaction
          .select({
            action: identityAuditEvents.action,
            occurredAt: identityAuditEvents.occurredAt,
          })
          .from(identityAuditEvents)
          .where(eq(identityAuditEvents.accountId, account.id))
          .orderBy(asc(identityAuditEvents.occurredAt));
        return {
          exportedAt: new Date().toISOString(),
          account: {
            id: account.id,
            email: account.email,
            status: account.status,
            twoFactorEnabled: account.twoFactorEnabled,
          },
          profile: profiles[0] ?? null,
          policyAcceptances: policies,
          activeRoleGrants: [],
          auditEvents: audits,
          session: { id: session.session.id },
        };
      }),

    requestDeletion: (
      headers: Headers,
      password: string,
      proof?: SecondFactorProof,
    ) =>
      database.transaction(async (transaction) => {
        const { account } = await confirmSecureAction(
          transaction,
          headers,
          password,
          proof,
        );
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 30 * 60 * 1_000);
        const token = randomBytes(32).toString("base64url");
        const tokenHash = hashDeletionToken(token, config.authSecret);
        const existing = await transaction
          .select({ id: identityAccountDeletionRequests.id })
          .from(identityAccountDeletionRequests)
          .where(
            and(
              eq(identityAccountDeletionRequests.accountId, account.id),
              inArray(identityAccountDeletionRequests.state, [
                "requested",
                "confirmed",
                "scheduled",
              ]),
            ),
          )
          .for("update");
        if (existing[0]) {
          await transaction
            .update(identityAccountDeletionRequests)
            .set({
              state: "requested",
              confirmationTokenHash: tokenHash,
              confirmationExpiresAt: expiresAt,
              confirmedAt: null,
              scheduledFor: null,
              updatedAt: now,
            })
            .where(eq(identityAccountDeletionRequests.id, existing[0].id));
        } else {
          await transaction.insert(identityAccountDeletionRequests).values({
            accountId: account.id,
            confirmationTokenHash: tokenHash,
            confirmationExpiresAt: expiresAt,
            requestedAt: now,
          });
        }
        const recipient = account.email;
        if (!recipient) throw new Error("active account email unavailable");
        const actionUrl = new URL(
          "/api/account/privacy/deletion/confirm",
          new URL(config.baseUrl).origin,
        );
        actionUrl.searchParams.set("token", token);
        await enqueueAuthEmail(
          transaction,
          config,
          account.id,
          {
            template: "deletion_confirmation",
            email: recipient,
            token,
            url: actionUrl.href,
          },
          expiresAt,
        );
        await transaction.insert(identityAuditEvents).values({
          accountId: account.id,
          action: "identity.account_deletion_requested.v1",
          payload: { confirmation: "email" },
          occurredAt: now,
        });
        return { status: true as const };
      }),

    confirmDeletion: (rawToken: string) =>
      database.transaction(async (transaction) => {
        const now = new Date();
        const tokenHash = hashDeletionToken(rawToken, config.authSecret);
        const rows = await transaction
          .select({
            id: identityAccountDeletionRequests.id,
            accountId: identityAccountDeletionRequests.accountId,
          })
          .from(identityAccountDeletionRequests)
          .where(
            and(
              eq(identityAccountDeletionRequests.state, "requested"),
              eq(identityAccountDeletionRequests.confirmationTokenHash, tokenHash),
              lte(sql`${now}`, identityAccountDeletionRequests.confirmationExpiresAt),
            ),
          )
          .for("update");
        const request = rows[0];
        if (!request) throw new Error("deletion confirmation is invalid");
        const accounts = await transaction
          .select({ status: identityAccounts.status })
          .from(identityAccounts)
          .where(eq(identityAccounts.id, request.accountId))
          .for("update");
        if (accounts[0]?.status !== "active") {
          throw new Error("deletion confirmation is invalid");
        }
        const scheduledFor = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
        await transaction
          .update(identityAccountDeletionRequests)
          .set({
            state: "scheduled",
            confirmationTokenHash: null,
            confirmationExpiresAt: null,
            confirmedAt: now,
            scheduledFor,
            updatedAt: now,
          })
          .where(eq(identityAccountDeletionRequests.id, request.id));
        await transaction
          .update(identityAccounts)
          .set({ status: "deletion_scheduled", updatedAt: now })
          .where(
            and(
              eq(identityAccounts.id, request.accountId),
              eq(identityAccounts.status, "active"),
            ),
          );
        await transaction
          .delete(identitySessions)
          .where(eq(identitySessions.userId, request.accountId));
        await testHooks?.afterDeletionScheduledWrites?.();
        await transaction.insert(identityAuditEvents).values({
          accountId: request.accountId,
          action: "identity.account_deletion_scheduled.v1",
          payload: { coolingPeriodDays: "7" },
          occurredAt: now,
        });
        await enqueueDomainEvent(transaction, {
          eventType: "identity.account_deletion_scheduled.v1",
          aggregateType: "identity.account",
          aggregateId: request.accountId,
          payload: { accountId: request.accountId },
          occurredAt: now,
        });
        return { status: true as const, scheduledFor: scheduledFor.toISOString() };
      }),

    cancelDeletion: (
      headers: Headers,
      command: {
        email: string;
        password: string;
        proof?: SecondFactorProof;
      },
    ) =>
      database.transaction(async (transaction) => {
        const accounts = await transaction
          .select({ id: identityAccounts.id, twoFactorEnabled: identityAccounts.twoFactorEnabled })
          .from(identityAccounts)
          .where(
            and(
              eq(identityAccounts.email, command.email),
              eq(identityAccounts.status, "deletion_scheduled"),
            ),
          )
          .for("update");
        const account = accounts[0];
        if (!account) throw new Error("cancellation credentials are invalid");
        const requests = await transaction
          .select({ id: identityAccountDeletionRequests.id })
          .from(identityAccountDeletionRequests)
          .where(
            and(
              eq(identityAccountDeletionRequests.accountId, account.id),
              eq(identityAccountDeletionRequests.state, "scheduled"),
            ),
          )
          .for("update");
        if (!requests[0]) throw new Error("cancellation request is unavailable");
        const auth = createTransactionAuth(transaction, config, inertCallbacks());
        const signedIn = await auth.api.signInEmail({
          body: { email: command.email, password: command.password },
          headers,
          returnHeaders: true,
        });
        let responseHeaders = signedIn.headers;
        if (account.twoFactorEnabled) {
          if (!command.proof) throw new Error("second factor required");
          const continuation = new Headers(headers);
          const cookie = signedIn.headers
            .getSetCookie()
            .map((value) => value.split(";", 1)[0])
            .join("; ");
          if (!cookie) throw new Error("second factor continuation unavailable");
          continuation.set("cookie", cookie);
          if (command.proof.kind === "totp") {
            const verified = await auth.api.verifyTOTP({
              body: { code: command.proof.code, trustDevice: false },
              headers: continuation,
              returnHeaders: true,
            });
            responseHeaders = verified.headers;
          } else {
            const verified = await auth.api.verifyBackupCode({
              body: {
                code: command.proof.code,
                disableSession: false,
                trustDevice: false,
              },
              headers: continuation,
              returnHeaders: true,
            });
            responseHeaders = verified.headers;
          }
        }
        const now = new Date();
        await transaction
          .update(identityAccounts)
          .set({ status: "active", updatedAt: now })
          .where(eq(identityAccounts.id, account.id));
        await transaction
          .update(identityAccountDeletionRequests)
          .set({ state: "cancelled", cancelledAt: now, updatedAt: now })
          .where(
            and(
              eq(identityAccountDeletionRequests.accountId, account.id),
              eq(identityAccountDeletionRequests.state, "scheduled"),
            ),
          );
        await transaction.insert(identityAuditEvents).values({
          accountId: account.id,
          action: "identity.account_deletion_cancelled.v1",
          payload: { authentication: account.twoFactorEnabled ? "password_mfa" : "password" },
          occurredAt: now,
        });
        return { status: true as const, headers: responseHeaders };
      }),
  };
}

export type IdentityRetentionOptions = {
  now?: Date;
  dryRun: boolean;
  batchLimit: number;
};

export async function runIdentityRetention(
  database: AppDatabase,
  options: IdentityRetentionOptions,
) {
  if (!Number.isInteger(options.batchLimit) || options.batchLimit < 1 || options.batchLimit > 1_000) {
    throw new Error("retention batch limit is invalid");
  }
  const now = options.now ?? new Date();
  const cutoffs = retentionCutoffs(now);
  return database.transaction(async (transaction) => {
    const expiredVerifications = await transaction
      .select({ id: identityVerifications.id })
      .from(identityVerifications)
      .where(lte(identityVerifications.expiresAt, cutoffs.transient))
      .limit(options.batchLimit);
    const expiredSessions = await transaction
      .select({ id: identitySessions.id })
      .from(identitySessions)
      .where(lte(identitySessions.expiresAt, cutoffs.transient))
      .limit(options.batchLimit);
    const expiredRateLimits = await transaction
      .select({ id: identityRateLimits.id })
      .from(identityRateLimits)
      .where(lte(identityRateLimits.lastRequest, cutoffs.transient.getTime()))
      .limit(options.batchLimit);
    const stalePayloads = await transaction
      .select({ id: identityEmailOutbox.id })
      .from(identityEmailOutbox)
      .where(
        and(
          or(
            eq(identityEmailOutbox.state, "sent"),
            eq(identityEmailOutbox.state, "expired"),
          ),
          lte(identityEmailOutbox.createdAt, cutoffs.transient),
        ),
      )
      .limit(options.batchLimit);
    const dueClosures = await transaction
      .select({
        id: identityAccountDeletionRequests.id,
        accountId: identityAccountDeletionRequests.accountId,
      })
      .from(identityAccountDeletionRequests)
      .where(
        and(
          eq(identityAccountDeletionRequests.state, "scheduled"),
          lte(identityAccountDeletionRequests.scheduledFor, now),
        ),
      )
      .limit(options.batchLimit)
      .for("update", { skipLocked: true });
    const staleEmailMetadata = await transaction
      .select({ id: identityEmailOutbox.id })
      .from(identityEmailOutbox)
      .where(
        and(
          inArray(identityEmailOutbox.state, ["sent", "dead_letter", "expired"]),
          lte(identityEmailOutbox.createdAt, cutoffs.delivery),
        ),
      )
      .limit(options.batchLimit);
    const stalePolicyAcceptances = await transaction
      .select({ id: identityPolicyAcceptances.id })
      .from(identityPolicyAcceptances)
      .innerJoin(
        identityAccounts,
        eq(identityPolicyAcceptances.accountId, identityAccounts.id),
      )
      .where(
        and(
          eq(identityAccounts.status, "closed"),
          lte(identityAccounts.closedAt, cutoffs.identityHistory),
        ),
      )
      .limit(options.batchLimit);
    const staleAuditEvents = await transaction
      .select({ id: identityAuditEvents.id })
      .from(identityAuditEvents)
      .innerJoin(identityAccounts, eq(identityAuditEvents.accountId, identityAccounts.id))
      .where(
        and(
          eq(identityAccounts.status, "closed"),
          lte(identityAccounts.closedAt, cutoffs.identityHistory),
        ),
      )
      .limit(options.batchLimit);
    const summary = {
      dryRun: options.dryRun,
      expiredVerifications: expiredVerifications.length,
      expiredSessions: expiredSessions.length,
      expiredRateLimits: expiredRateLimits.length,
      clearedEmailPayloads: stalePayloads.length,
      deletedEmailMetadata: staleEmailMetadata.length,
      removedPolicyAcceptances: stalePolicyAcceptances.length,
      anonymizedAuditEvents: staleAuditEvents.length,
      completedDeletions: dueClosures.length,
    };
    if (options.dryRun) return summary;
    if (expiredVerifications.length) {
      await transaction.delete(identityVerifications).where(
        inArray(identityVerifications.id, expiredVerifications.map((row) => row.id)),
      );
    }
    if (expiredSessions.length) {
      await transaction.delete(identitySessions).where(
        inArray(identitySessions.id, expiredSessions.map((row) => row.id)),
      );
    }
    if (expiredRateLimits.length) {
      await transaction.delete(identityRateLimits).where(
        inArray(identityRateLimits.id, expiredRateLimits.map((row) => row.id)),
      );
    }
    if (stalePayloads.length) {
      await transaction
        .update(identityEmailOutbox)
        .set({ encryptedPayload: null })
        .where(inArray(identityEmailOutbox.id, stalePayloads.map((row) => row.id)));
    }
    if (staleEmailMetadata.length) {
      await transaction.delete(identityEmailOutbox).where(
        inArray(identityEmailOutbox.id, staleEmailMetadata.map((row) => row.id)),
      );
    }
    for (const closure of dueClosures) {
      const accountRows = await transaction
        .select({ email: identityAccounts.email })
        .from(identityAccounts)
        .where(eq(identityAccounts.id, closure.accountId));
      const closingEmail = accountRows[0]?.email;
      await transaction.delete(identityAuthFactors).where(eq(identityAuthFactors.userId, closure.accountId));
      await transaction.delete(identitySessions).where(eq(identitySessions.userId, closure.accountId));
      await transaction
        .delete(identityVerifications)
        .where(
          closingEmail
            ? or(
                eq(identityVerifications.value, closure.accountId),
                sql`${identityVerifications.identifier} like ${`%:${closingEmail}`}`,
              )
            : eq(identityVerifications.value, closure.accountId),
        );
      await transaction.delete(identityTwoFactors).where(eq(identityTwoFactors.userId, closure.accountId));
      await transaction.delete(identityEmailOutbox).where(eq(identityEmailOutbox.accountId, closure.accountId));
      await transaction
        .update(identityProfiles)
        .set({
          displayName: "บัญชีที่ปิด",
          locale: "th-TH",
          timeZone: "Asia/Bangkok",
          updatedAt: now,
        })
        .where(eq(identityProfiles.accountId, closure.accountId));
      await transaction
        .update(identityPolicyAcceptances)
        .set({ ipAddress: null, userAgent: null })
        .where(eq(identityPolicyAcceptances.accountId, closure.accountId));
      await transaction
        .update(identityAccounts)
        .set({
          name: null,
          email: null,
          image: null,
          status: "closed",
          twoFactorEnabled: false,
          closedAt: now,
          updatedAt: now,
        })
        .where(eq(identityAccounts.id, closure.accountId));
      await transaction
        .update(identityAccountDeletionRequests)
        .set({ state: "completed", completedAt: now, updatedAt: now })
        .where(eq(identityAccountDeletionRequests.id, closure.id));
      await transaction.insert(identityAuditEvents).values({
        accountId: closure.accountId,
        action: "identity.account_closed.v1",
        payload: { reasonCode: "user_requested" },
        occurredAt: now,
      });
      await enqueueDomainEvent(transaction, {
        eventType: "identity.account_closed.v1",
        aggregateType: "identity.account",
        aggregateId: closure.accountId,
        payload: { accountId: closure.accountId },
        occurredAt: now,
      });
    }
    if (stalePolicyAcceptances.length) {
      await transaction.delete(identityPolicyAcceptances).where(
        inArray(
          identityPolicyAcceptances.id,
          stalePolicyAcceptances.map((row) => row.id),
        ),
      );
    }
    if (staleAuditEvents.length) {
      await transaction
        .update(identityAuditEvents)
        .set({ payload: { retention: "anonymized" } })
        .where(inArray(identityAuditEvents.id, staleAuditEvents.map((row) => row.id)));
    }
    return summary;
  });
}
