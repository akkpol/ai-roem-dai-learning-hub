import { describe, expect, it, vi } from "vitest";

import { createTransactionAuth } from "@/modules/identity/auth";
import type { IdentityConfig } from "@/modules/identity/config";

const { betterAuthMock } = vi.hoisted(() => ({
  betterAuthMock: vi.fn((options: unknown) => options),
}));

vi.mock("better-auth", () => ({ betterAuth: betterAuthMock }));
vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: vi.fn(() => ({ adapter: "test" })),
}));
vi.mock("better-auth/plugins", () => ({
  twoFactor: vi.fn(() => ({ id: "two-factor" })),
}));

const config = {
  authSecret: "a".repeat(32),
  baseUrl: "https://learning.example.test/api/auth",
  emailEncryptionKey: Buffer.alloc(32),
  emailKeyVersion: "v1",
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  emailFrom: "Learning Hub <auth@learning.example.test>",
  trustedProxy: "none",
  googleOAuth: {
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
  },
} satisfies IdentityConfig;

function transaction(
  status: "active" | "suspended",
  twoFactorEnabled = false,
) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ status, twoFactorEnabled }]),
      })),
    })),
  };
}

describe("Google provider configuration", () => {
  it("encrypts provider tokens and forbids social signup", () => {
    createTransactionAuth(transaction("active") as never, config, {
      sendVerificationEmail: async () => undefined,
      sendResetPassword: async () => undefined,
    });

    expect(betterAuthMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        socialProviders: {
          google: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
            disableSignUp: true,
            prompt: "select_account",
          },
        },
        account: { encryptOAuthTokens: true },
      }),
    );
  });

  it("creates sessions only for active accounts", async () => {
    const active = createTransactionAuth(
      transaction("active") as never,
      config,
      {
        sendVerificationEmail: async () => undefined,
        sendResetPassword: async () => undefined,
      },
    ) as unknown as {
      databaseHooks: {
        session: {
          create: {
            before: (session: { userId: string }) => Promise<boolean>;
          };
        };
      };
    };
    const suspended = createTransactionAuth(
      transaction("suspended") as never,
      config,
      {
        sendVerificationEmail: async () => undefined,
        sendResetPassword: async () => undefined,
      },
    ) as unknown as typeof active;

    expect(
      await active.databaseHooks.session.create.before({ userId: "active-id" }),
    ).toBe(true);
    expect(
      await suspended.databaseHooks.session.create.before({
        userId: "suspended-id",
      }),
    ).toBe(false);
  });

  it("does not let Google OAuth bypass an enabled second factor", async () => {
    const auth = createTransactionAuth(
      transaction("active", true) as never,
      config,
      {
        sendVerificationEmail: async () => undefined,
        sendResetPassword: async () => undefined,
      },
      { googleOAuthCallback: true },
    ) as unknown as {
      databaseHooks: {
        session: {
          create: {
            before: (session: { userId: string }) => Promise<boolean>;
          };
        };
      };
    };

    expect(
      await auth.databaseHooks.session.create.before({ userId: "mfa-id" }),
    ).toBe(false);
  });
});
