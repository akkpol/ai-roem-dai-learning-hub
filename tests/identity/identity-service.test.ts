import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/platform/database/client";
import { genericAuthMessage, type SignUpCommand } from "@/modules/identity/contracts";
import { createTransactionAuth } from "@/modules/identity/auth";
import { createAuthHttpHandlers } from "@/modules/identity/http";
import { createIdentityService } from "@/modules/identity/service";

vi.mock("@/modules/identity/auth", () => ({
  createTransactionAuth: vi.fn(),
}));

const config = {
  authSecret: "a".repeat(32),
  baseUrl: "https://learning.example.test/api/auth",
  emailEncryptionKey: Buffer.alloc(32),
  emailKeyVersion: "v1",
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  emailFrom: "Learning Hub <auth@learn.example.test>",
  trustedProxy: "none" as const,
};

const command: SignUpCommand = {
  displayName: "Learner",
  email: "learner@example.test",
  password: "correct-horse-battery-staple",
  acceptedAt: new Date("2026-07-16T00:00:00.000Z"),
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  callbackPath: "/verify-email",
};

function databaseWithExistingAccount(
  existing: boolean,
  concurrentExisting = false,
): AppDatabase {
  const transaction = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => (existing ? [{ id: "existing-id" }] : [])),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    execute: vi.fn(async () => undefined),
  };
  return {
    transaction: vi.fn(async (work) => work(transaction)),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () =>
          concurrentExisting ? [{ id: "concurrent-id" }] : [],
        ),
      })),
    })),
  } as unknown as AppDatabase;
}

describe("Identity signup enumeration resistance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits a known account before Better Auth and returns the generic result", async () => {
    const service = createIdentityService(databaseWithExistingAccount(true), config);

    await expect(service.signUp(command)).resolves.toEqual({
      status: true,
      message: genericAuthMessage,
    });
    expect(createTransactionAuth).not.toHaveBeenCalled();
  });

  it("normalizes only the concurrent account-email unique conflict", async () => {
    vi.mocked(createTransactionAuth).mockReturnValue({
      api: {
        signUpEmail: vi.fn(async () => {
          throw Object.assign(new Error("duplicate"), {
            code: "23505",
            constraint: "identity_accounts_email_unique",
          });
        }),
      },
    } as never);
    const service = createIdentityService(databaseWithExistingAccount(false), config);

    await expect(service.signUp(command)).resolves.toEqual({
      status: true,
      message: genericAuthMessage,
    });
  });

  it("does not swallow an unrelated signup failure", async () => {
    vi.mocked(createTransactionAuth).mockReturnValue({
      api: {
        signUpEmail: vi.fn(async () => {
          throw Object.assign(new Error("database unavailable"), { code: "57P01" });
        }),
      },
    } as never);
    const service = createIdentityService(databaseWithExistingAccount(false), config);

    await expect(service.signUp(command)).rejects.toThrow("database unavailable");
  });

  it("normalizes Better Auth's wrapped create-user failure only when the concurrent account now exists", async () => {
    vi.mocked(createTransactionAuth).mockReturnValue({
      api: {
        signUpEmail: vi.fn(async () => {
          throw Object.assign(new Error("Failed to create user"), {
            body: { code: "FAILED_TO_CREATE_USER" },
          });
        }),
      },
    } as never);
    const service = createIdentityService(
      databaseWithExistingAccount(false, true),
      config,
    );

    await expect(service.signUp(command)).resolves.toEqual({
      status: true,
      message: genericAuthMessage,
    });
  });

  it("rethrows Better Auth's wrapped create-user failure when no concurrent account exists", async () => {
    vi.mocked(createTransactionAuth).mockReturnValue({
      api: {
        signUpEmail: vi.fn(async () => {
          throw Object.assign(new Error("Failed to create user"), {
            body: { code: "FAILED_TO_CREATE_USER" },
          });
        }),
      },
    } as never);
    const service = createIdentityService(databaseWithExistingAccount(false), config);

    await expect(service.signUp(command)).rejects.toThrow("Failed to create user");
  });

  it("returns an indistinguishable HTTP status and body for new, existing, and concurrent duplicate signup", async () => {
    const request = () =>
      new Request("https://learning.example.test/api/auth/sign-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://learning.example.test",
        },
        body: JSON.stringify({
          displayName: command.displayName,
          email: command.email,
          password: command.password,
          termsVersion: command.termsVersion,
          privacyVersion: command.privacyVersion,
          callbackPath: command.callbackPath,
        }),
      });
    const publicSignup = (database: AppDatabase) =>
      createAuthHttpHandlers({
        config,
        service: createIdentityService(database, config),
        consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
      }).signUp(request());

    vi.mocked(createTransactionAuth)
      .mockReturnValueOnce({
        api: {
          signUpEmail: vi.fn(async () => ({ user: { id: "new-account" } })),
        },
      } as never)
      .mockReturnValueOnce({
        api: {
          signUpEmail: vi.fn(async () => {
            throw Object.assign(new Error("duplicate"), {
              code: "23505",
              constraint: "identity_accounts_email_unique",
            });
          }),
        },
      } as never);

    const newAccount = await publicSignup(databaseWithExistingAccount(false));
    const existingAccount = await publicSignup(databaseWithExistingAccount(true));
    const concurrentDuplicate = await publicSignup(databaseWithExistingAccount(false));
    const newBody = await newAccount.text();
    const existingBody = await existingAccount.text();
    const duplicateBody = await concurrentDuplicate.text();

    expect([
      [newAccount.status, newBody],
      [existingAccount.status, existingBody],
      [concurrentDuplicate.status, duplicateBody],
    ]).toEqual([
      [200, newBody],
      [200, newBody],
      [200, newBody],
    ]);
  });
});
