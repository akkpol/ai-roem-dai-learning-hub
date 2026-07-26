import { describe, expect, it, vi } from "vitest";

import {
  calculateEmailRetry,
  createAuthEmailDispatcher,
  type AuthEmailOutboxRepository,
} from "@/modules/identity/email/dispatcher";
import type { AuthEmailSender } from "@/modules/identity/email/sender";

const now = new Date("2026-07-24T00:00:00.000Z");

const claimed = {
  id: "00000000-0000-4000-8000-000000000010",
  accountId: "00000000-0000-4000-8000-000000000011",
  encryptedPayload: "ciphertext",
  attemptCount: 1,
  expiresAt: new Date("2026-07-24T00:30:00.000Z"),
  leaseToken: "00000000-0000-4000-8000-000000000012",
};

function repository(
  overrides: Partial<AuthEmailOutboxRepository> = {},
): AuthEmailOutboxRepository {
  return {
    expireStale: vi.fn(async () => 0),
    claimBatch: vi.fn(async () => [claimed]),
    markSent: vi.fn(async () => undefined),
    markRetry: vi.fn(async () => undefined),
    markDeadLetter: vi.fn(async () => undefined),
    markExpired: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("SESSION-006 authentication email dispatcher", () => {
  it("claims with a lease and sends using the outbox UUID as idempotency key", async () => {
    const repo = repository();
    const sender: AuthEmailSender = {
      send: vi.fn(async () => ({ providerMessageId: "resend-message-1" })),
    };
    const dispatcher = createAuthEmailDispatcher({
      repository: repo,
      sender,
      decrypt: () => ({
        template: "verify_email",
        email: "person@example.com",
        token: "secret-never-logged",
        url: "https://example.test/api/auth/verify-email?token=secret",
      }),
      now: () => now,
      workerId: "worker-a",
    });

    await dispatcher.runBatch(25);

    expect(repo.claimBatch).toHaveBeenCalledWith({
      limit: 25,
      now,
      workerId: "worker-a",
    });
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: claimed.id,
        recipient: "person@example.com",
      }),
    );
    expect(repo.markSent).toHaveBeenCalledWith({
      id: claimed.id,
      leaseToken: claimed.leaseToken,
      providerMessageId: "resend-message-1",
      sentAt: now,
    });
  });

  it("uses bounded exponential backoff and dead-letters the fifth failure", () => {
    expect(calculateEmailRetry(1, now)).toEqual({
      state: "retry_wait",
      nextAttemptAt: new Date("2026-07-24T00:02:00.000Z"),
    });
    expect(calculateEmailRetry(5, now)).toEqual({ state: "dead_letter" });
  });

  it("purges payload on terminal failure without leaking provider text", async () => {
    const repo = repository();
    const sender: AuthEmailSender = {
      send: vi.fn(async () => {
        throw new Error("provider said token=secret and person@example.com");
      }),
    };
    const dispatcher = createAuthEmailDispatcher({
      repository: repo,
      sender,
      decrypt: () => ({
        template: "reset_password",
        email: "person@example.com",
        token: "secret",
        url: "https://example.test/reset-password?token=secret",
      }),
      now: () => now,
      workerId: "worker-a",
    });

    await dispatcher.runBatch(1, { maxAttempts: 2 });

    expect(repo.markDeadLetter).toHaveBeenCalledWith({
      id: claimed.id,
      leaseToken: claimed.leaseToken,
      failedAt: now,
      errorCode: "provider_rejected",
    });
    expect(JSON.stringify(vi.mocked(repo.markDeadLetter).mock.calls)).not.toContain(
      "person@example.com",
    );
  });

  it("expires work before decrypting or contacting the provider", async () => {
    const repo = repository({
      claimBatch: vi.fn(async () => [
        { ...claimed, expiresAt: new Date("2026-07-23T23:59:59.000Z") },
      ]),
    });
    const sender: AuthEmailSender = {
      send: vi.fn(async () => ({ providerMessageId: "never" })),
    };
    const decrypt = vi.fn();
    const dispatcher = createAuthEmailDispatcher({
      repository: repo,
      sender,
      decrypt,
      now: () => now,
      workerId: "worker-a",
    });

    await dispatcher.runBatch(1);

    expect(repo.markExpired).toHaveBeenCalledOnce();
    expect(decrypt).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("purges already-expired queued work before attempting a claim", async () => {
    const repo = repository({
      expireStale: vi.fn(async () => 2),
      claimBatch: vi.fn(async () => []),
    });
    const sender: AuthEmailSender = {
      send: vi.fn(async () => ({ providerMessageId: "never" })),
    };
    const telemetry = vi.fn();
    const dispatcher = createAuthEmailDispatcher({
      repository: repo,
      sender,
      decrypt: vi.fn(),
      now: () => now,
      workerId: "worker-a",
      telemetry,
    });

    await expect(dispatcher.runBatch(10)).resolves.toEqual({
      claimed: 0,
      sent: 0,
      retried: 0,
      deadLettered: 0,
      expired: 2,
    });
    expect(repo.expireStale).toHaveBeenCalledWith({ now, limit: 10 });
    expect(telemetry).toHaveBeenCalledWith(
      "identity.email_outbox.expired",
      { count: 2 },
    );
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("keeps a persisted dead letter visible to scheduler retries", async () => {
    const repo = repository({
      claimBatch: vi.fn(async () => []),
      measureBacklog: vi.fn(async () => ({
        oldestPendingAgeMs: 0,
        retryWaitCount: 2,
        deadLetterCount: 1,
      })),
    });
    const telemetry = vi.fn();
    const result = await createAuthEmailDispatcher({
      repository: repo,
      sender: { send: vi.fn() },
      decrypt: vi.fn(),
      now: () => now,
      workerId: "worker-a",
      telemetry,
    }).runBatch(10);

    expect(result).toMatchObject({
      oldestPendingAgeMs: 0,
      retryWaitCount: 2,
      deadLetterCount: 1,
      requiresAttention: 1,
    });
    expect(telemetry).toHaveBeenCalledWith(
      "identity.email_outbox.alert",
      expect.objectContaining({ deadLetterCount: 1 }),
    );
  });
});
