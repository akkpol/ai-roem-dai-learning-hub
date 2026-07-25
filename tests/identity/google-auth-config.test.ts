import { describe, expect, it, vi } from "vitest";

import { createTransactionAuth } from "@/modules/identity/auth";
import type { GoogleAuthConfig } from "@/modules/identity/config";

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
  trustedProxy: "none",
  googleOAuth: {
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
  },
  currentPolicies: {
    termsVersion: "terms-v1",
    privacyVersion: "privacy-v1",
  },
} satisfies GoogleAuthConfig;

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
  it("encrypts provider tokens and allows Google signup", () => {
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
            disableSignUp: false,
            prompt: "select_account",
          },
        },
        account: { encryptOAuthTokens: true },
        user: expect.objectContaining({
          additionalFields: expect.not.objectContaining({
            ageAttestedAt: expect.anything(),
          }),
        }),
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

  it("wires Google user creation hooks only for the OAuth callback", async () => {
    const beforeGoogleUserCreate = vi.fn(async () => ({
      status: "active" as const,
    }));
    const afterGoogleUserCreate = vi.fn(async () => undefined);
    const auth = createTransactionAuth(
      transaction("active") as never,
      config,
      {
        sendVerificationEmail: async () => undefined,
        sendResetPassword: async () => undefined,
        beforeGoogleUserCreate,
        afterGoogleUserCreate,
      },
      { googleOAuthCallback: true },
    ) as unknown as {
      databaseHooks: {
        user: {
          create: {
            before: (user: object) => Promise<{ data: { status: "active" } }>;
            after: (user: object) => Promise<void>;
          };
        };
      };
    };

    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Google Learner",
      email: "learner@example.test",
      emailVerified: true,
    };
    await expect(
      auth.databaseHooks.user.create.before(user),
    ).resolves.toEqual({ data: { status: "active" } });
    await auth.databaseHooks.user.create.after(user);
    expect(beforeGoogleUserCreate).toHaveBeenCalledWith(user);
    expect(afterGoogleUserCreate).toHaveBeenCalledWith(user);
  });
});
