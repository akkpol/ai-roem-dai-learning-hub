import { and, eq, sql } from "drizzle-orm";

import type { AppDatabase } from "@/platform/database/client";

import type { AuthEmailIntent } from "./crypto";
import type { AuthEmailProviderError, AuthEmailSender } from "./sender";
import { identityEmailOutbox } from "../schema";

export type ClaimedAuthEmail = {
  id: string;
  accountId: string;
  encryptedPayload: string;
  attemptCount: number;
  expiresAt: Date;
  leaseToken: string;
};

export type AuthEmailOutboxRepository = {
  claimBatch(input: {
    limit: number;
    now: Date;
    workerId: string;
  }): Promise<ClaimedAuthEmail[]>;
  markSent(input: {
    id: string;
    leaseToken: string;
    providerMessageId: string;
    sentAt: Date;
  }): Promise<void>;
  markRetry(input: {
    id: string;
    leaseToken: string;
    nextAttemptAt: Date;
    failedAt: Date;
    errorCode: string;
  }): Promise<void>;
  markDeadLetter(input: {
    id: string;
    leaseToken: string;
    failedAt: Date;
    errorCode: string;
  }): Promise<void>;
  markExpired(input: {
    id: string;
    leaseToken: string;
    expiredAt: Date;
  }): Promise<void>;
};

type RetryDecision =
  | { state: "retry_wait"; nextAttemptAt: Date }
  | { state: "dead_letter" };

export function calculateEmailRetry(
  attemptCount: number,
  now: Date,
  maxAttempts = 5,
  retryAfterMs?: number,
): RetryDecision {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new Error("email attempt count is invalid");
  }
  if (attemptCount >= maxAttempts) return { state: "dead_letter" };
  const exponential = Math.min(2 ** attemptCount * 60_000, 60 * 60_000);
  const delay = Math.min(
    Math.max(retryAfterMs ?? exponential, exponential),
    24 * 60 * 60_000,
  );
  return {
    state: "retry_wait",
    nextAttemptAt: new Date(now.getTime() + delay),
  };
}

function providerFailure(error: unknown): {
  code: string;
  retryable: boolean;
  retryAfterMs?: number;
} {
  const typed = error as Partial<AuthEmailProviderError>;
  if (typed.name === "AuthEmailProviderError" && typed.code) {
    return {
      code: typed.code,
      retryable: typed.retryable === true,
      retryAfterMs: typed.retryAfterMs,
    };
  }
  return { code: "provider_rejected", retryable: false };
}

export function createAuthEmailDispatcher(input: {
  repository: AuthEmailOutboxRepository;
  sender: AuthEmailSender;
  decrypt(payload: string): AuthEmailIntent;
  now?: () => Date;
  workerId: string;
  telemetry?(
    event: string,
    fields: Record<string, string | number | boolean>,
  ): void;
}) {
  const now = input.now ?? (() => new Date());
  return {
    async runBatch(
      limit: number,
      options: { maxAttempts?: number } = {},
    ): Promise<{
      claimed: number;
      sent: number;
      retried: number;
      deadLettered: number;
      expired: number;
    }> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("email dispatch batch limit is invalid");
      }
      const startedAt = now();
      const claimed = await input.repository.claimBatch({
        limit,
        now: startedAt,
        workerId: input.workerId,
      });
      const summary = {
        claimed: claimed.length,
        sent: 0,
        retried: 0,
        deadLettered: 0,
        expired: 0,
      };
      for (const item of claimed) {
        const completedAt = now();
        if (item.expiresAt <= completedAt) {
          await input.repository.markExpired({
            id: item.id,
            leaseToken: item.leaseToken,
            expiredAt: completedAt,
          });
          input.telemetry?.("identity.email_outbox.expired", {
            outboxId: item.id,
            attemptCount: item.attemptCount,
          });
          summary.expired += 1;
          continue;
        }
        try {
          const intent = input.decrypt(item.encryptedPayload);
          const result = await input.sender.send({
            template: intent.template,
            recipient: intent.email,
            actionUrl: intent.url,
            idempotencyKey: item.id,
          });
          await input.repository.markSent({
            id: item.id,
            leaseToken: item.leaseToken,
            providerMessageId: result.providerMessageId,
            sentAt: completedAt,
          });
          input.telemetry?.("identity.email_outbox.sent", {
            outboxId: item.id,
            attemptCount: item.attemptCount,
          });
          summary.sent += 1;
        } catch (error) {
          const failure = providerFailure(error);
          const decision = failure.retryable
            ? calculateEmailRetry(
                item.attemptCount,
                completedAt,
                options.maxAttempts,
                failure.retryAfterMs,
              )
            : { state: "dead_letter" as const };
          if (decision.state === "retry_wait") {
            await input.repository.markRetry({
              id: item.id,
              leaseToken: item.leaseToken,
              nextAttemptAt: decision.nextAttemptAt,
              failedAt: completedAt,
              errorCode: failure.code,
            });
            input.telemetry?.("identity.email_outbox.retry", {
              outboxId: item.id,
              attemptCount: item.attemptCount,
              errorCode: failure.code,
            });
            summary.retried += 1;
          } else {
            await input.repository.markDeadLetter({
              id: item.id,
              leaseToken: item.leaseToken,
              failedAt: completedAt,
              errorCode: failure.code,
            });
            input.telemetry?.("identity.email_outbox.dead_letter", {
              outboxId: item.id,
              attemptCount: item.attemptCount,
              errorCode: failure.code,
            });
            summary.deadLettered += 1;
          }
        }
      }
      return summary;
    },
  };
}

function assertLeaseMutation(rowCount: number): void {
  if (rowCount !== 1) throw new Error("email outbox lease was lost");
}

export function createPostgresAuthEmailOutboxRepository(
  database: AppDatabase,
  leaseMs = 5 * 60_000,
): AuthEmailOutboxRepository {
  return {
    claimBatch: async ({ limit, now }) =>
      database.transaction(async (transaction) => {
        const result = await transaction.execute<ClaimedAuthEmail>(sql`
          with candidates as (
            select id
            from identity_email_outbox
            where (
              (
                state in ('pending', 'retry_wait')
                and next_attempt_at <= ${now}::timestamptz
              )
              or (
                state = 'sending'
                and lease_expires_at <= ${now}::timestamptz
              )
            )
            and expires_at > ${now}::timestamptz
            order by next_attempt_at, created_at, id
            for update skip locked
            limit ${limit}
          )
          update identity_email_outbox as outbox
          set
            state = 'sending',
            attempt_count = outbox.attempt_count + 1,
            lease_token = gen_random_uuid(),
            lease_expires_at = ${new Date(now.getTime() + leaseMs)}::timestamptz,
            last_error_code = null
          from candidates
          where outbox.id = candidates.id
          returning
            outbox.id,
            outbox.account_id as "accountId",
            outbox.encrypted_payload as "encryptedPayload",
            outbox.attempt_count as "attemptCount",
            outbox.expires_at as "expiresAt",
            outbox.lease_token as "leaseToken"
        `);
        return result.rows;
      }),
    markSent: async ({
      id,
      leaseToken,
      providerMessageId,
      sentAt,
    }) => {
      const rows = await database
        .update(identityEmailOutbox)
        .set({
          state: "sent",
          encryptedPayload: null,
          leaseToken: null,
          leaseExpiresAt: null,
          providerMessageId,
          sentAt,
          lastErrorCode: null,
        })
        .where(
          and(
            eq(identityEmailOutbox.id, id),
            eq(identityEmailOutbox.state, "sending"),
            eq(identityEmailOutbox.leaseToken, leaseToken),
          ),
        )
        .returning({ id: identityEmailOutbox.id });
      assertLeaseMutation(rows.length);
    },
    markRetry: async ({
      id,
      leaseToken,
      nextAttemptAt,
      errorCode,
    }) => {
      const rows = await database
        .update(identityEmailOutbox)
        .set({
          state: "retry_wait",
          nextAttemptAt,
          leaseToken: null,
          leaseExpiresAt: null,
          lastErrorCode: errorCode,
        })
        .where(
          and(
            eq(identityEmailOutbox.id, id),
            eq(identityEmailOutbox.state, "sending"),
            eq(identityEmailOutbox.leaseToken, leaseToken),
          ),
        )
        .returning({ id: identityEmailOutbox.id });
      assertLeaseMutation(rows.length);
    },
    markDeadLetter: async ({ id, leaseToken, errorCode }) => {
      const rows = await database
        .update(identityEmailOutbox)
        .set({
          state: "dead_letter",
          encryptedPayload: null,
          leaseToken: null,
          leaseExpiresAt: null,
          lastErrorCode: errorCode,
        })
        .where(
          and(
            eq(identityEmailOutbox.id, id),
            eq(identityEmailOutbox.state, "sending"),
            eq(identityEmailOutbox.leaseToken, leaseToken),
          ),
        )
        .returning({ id: identityEmailOutbox.id });
      assertLeaseMutation(rows.length);
    },
    markExpired: async ({ id, leaseToken }) => {
      const rows = await database
        .update(identityEmailOutbox)
        .set({
          state: "expired",
          encryptedPayload: null,
          leaseToken: null,
          leaseExpiresAt: null,
          lastErrorCode: "token_expired",
        })
        .where(
          and(
            eq(identityEmailOutbox.id, id),
            eq(identityEmailOutbox.state, "sending"),
            eq(identityEmailOutbox.leaseToken, leaseToken),
          ),
        )
        .returning({ id: identityEmailOutbox.id });
      assertLeaseMutation(rows.length);
    },
  };
}
