import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleAuthConfig } from "@/modules/identity/config";
import { createGoogleLoginHandlers } from "@/modules/identity/google-login";

const { signInSocial, authHandler, createTransactionAuthMock, getOAuthStateMock } = vi.hoisted(
  () => {
    const signInSocial = vi.fn();
    const authHandler = vi.fn();
    return {
      signInSocial,
      authHandler,
      createTransactionAuthMock: vi.fn(
        (...args: unknown[]) => {
          void args;
          return {
          api: { signInSocial },
          handler: authHandler,
          };
        },
      ),
      getOAuthStateMock: vi.fn(),
    };
  },
);

vi.mock("@/modules/identity/auth", () => ({
  createTransactionAuth: createTransactionAuthMock,
}));
vi.mock("better-auth/api", () => ({
  getOAuthState: getOAuthStateMock,
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
    termsUrl: "/terms",
    privacyUrl: "/privacy",
  },
} satisfies GoogleAuthConfig;

function database() {
  return {
    transaction: vi.fn(async (work: (transaction: object) => Promise<Response>) =>
      work({}),
    ),
  };
}

describe("Google login boundary", () => {
  beforeEach(() => {
    signInSocial.mockReset();
    authHandler.mockReset();
    getOAuthStateMock.mockReset();
    createTransactionAuthMock.mockClear();
  });

  it("preserves the OAuth state and PKCE response cookies", async () => {
    signInSocial.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          location: "https://accounts.google.test/oauth",
          "set-cookie": "better-auth.state=signed; HttpOnly; Secure",
        },
      }),
    );
    const handlers = createGoogleLoginHandlers(database() as never, config);

    const response = await handlers.start(
      new Request("https://learning.example.test/api/auth/google", {
        method: "POST",
        headers: { origin: "https://learning.example.test" },
      }),
    );

    expect(signInSocial).toHaveBeenCalledWith({
      body: {
        provider: "google",
        requestSignUp: true,
        callbackURL: "/",
        errorCallbackURL: "/sign-in/google-error",
        additionalData: {
          policyAcceptedAt: expect.any(String),
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
        },
      },
      headers: expect.any(Headers),
      asResponse: true,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.test/oauth",
    );
    expect(response.headers.get("set-cookie")).toContain("better-auth.state");
  });

  it("onboards a new verified Google user with profile, current policies, and audit hooks", async () => {
    const transaction = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
        })),
      })),
      execute: vi.fn(async () => undefined),
    };
    const onboardingDatabase = {
      transaction: vi.fn(async (work: (value: object) => Promise<Response>) =>
        work(transaction),
      ),
    };
    getOAuthStateMock.mockResolvedValue({
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      policyAcceptedAt: "2026-07-26T00:00:00.000Z",
    });
    authHandler.mockImplementationOnce(async () => {
      const callbacks = createTransactionAuthMock.mock.calls.at(-1)?.[2] as {
        beforeGoogleUserCreate(user: {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
        }): Promise<{ status: "active" }>;
        afterGoogleUserCreate(user: {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
        }): Promise<void>;
      };
      const user = {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Google Learner",
        email: "learner@example.test",
        emailVerified: true,
      };
      await expect(callbacks.beforeGoogleUserCreate(user)).resolves.toEqual({
        status: "active",
      });
      await callbacks.afterGoogleUserCreate(user);
      return new Response(null, {
        status: 302,
        headers: { location: "https://learning.example.test/" },
      });
    });

    const response = await createGoogleLoginHandlers(
      onboardingDatabase as never,
      config,
    ).callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
        { headers: { "user-agent": "test-browser" } },
      ),
    );

    expect(response.status).toBe(302);
    expect(transaction.insert).toHaveBeenCalledTimes(2);
    expect(transaction.execute).toHaveBeenCalledTimes(2);
  });

  it("persists exact policy acceptance idempotently for an existing Google user", async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const transaction = { insert: vi.fn(() => ({ values })) };
    const existingDatabase = {
      transaction: vi.fn(async (work: (value: object) => Promise<Response>) =>
        work(transaction),
      ),
    };
    getOAuthStateMock.mockResolvedValue({
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      policyAcceptedAt: "2026-07-26T00:00:00.000Z",
    });
    authHandler.mockImplementationOnce(async () => {
      const callbacks = createTransactionAuthMock.mock.calls.at(-1)?.[2] as {
        beforeGoogleSessionCreate(userId: string): Promise<void>;
      };
      await callbacks.beforeGoogleSessionCreate(
        "22222222-2222-4222-8222-222222222222",
      );
      return new Response(null, {
        status: 302,
        headers: { location: "https://learning.example.test/" },
      });
    });

    const response = await createGoogleLoginHandlers(
      existingDatabase as never,
      config,
    ).callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
        { headers: { "user-agent": "test-browser" } },
      ),
    );

    expect(response.status).toBe(302);
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        accountId: "22222222-2222-4222-8222-222222222222",
        policyType: "terms",
        policyVersion: "terms-v1",
      }),
      expect.objectContaining({
        accountId: "22222222-2222-4222-8222-222222222222",
        policyType: "privacy",
        policyVersion: "privacy-v1",
      }),
    ]);
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("rolls back an existing-user callback when signed policy state is missing", async () => {
    let rollbackObserved = false;
    const transaction = { insert: vi.fn() };
    const existingDatabase = {
      transaction: vi.fn(async (work: (value: object) => Promise<Response>) => {
        try {
          return await work(transaction);
        } catch (error) {
          rollbackObserved = true;
          throw error;
        }
      }),
    };
    getOAuthStateMock.mockResolvedValue(null);
    authHandler.mockImplementationOnce(async () => {
      const callbacks = createTransactionAuthMock.mock.calls.at(-1)?.[2] as {
        beforeGoogleSessionCreate(userId: string): Promise<void>;
      };
      await callbacks.beforeGoogleSessionCreate(
        "22222222-2222-4222-8222-222222222222",
      );
      return new Response(null, { status: 302 });
    });

    const response = await createGoogleLoginHandlers(
      existingDatabase as never,
      config,
    ).callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
      ),
    );

    expect(rollbackObserved).toBe(true);
    expect(response.status).toBe(303);
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it("rolls back an existing-user callback when the current policy version changed", async () => {
    let rollbackObserved = false;
    const transaction = { insert: vi.fn() };
    const existingDatabase = {
      transaction: vi.fn(async (work: (value: object) => Promise<Response>) => {
        try {
          return await work(transaction);
        } catch (error) {
          rollbackObserved = true;
          throw error;
        }
      }),
    };
    getOAuthStateMock.mockResolvedValue({
      termsVersion: "terms-previous",
      privacyVersion: "privacy-v1",
      policyAcceptedAt: "2026-07-26T00:00:00.000Z",
    });
    authHandler.mockImplementationOnce(async () => {
      const callbacks = createTransactionAuthMock.mock.calls.at(-1)?.[2] as {
        beforeGoogleSessionCreate(userId: string): Promise<void>;
      };
      await callbacks.beforeGoogleSessionCreate(
        "22222222-2222-4222-8222-222222222222",
      );
      return new Response(null, { status: 302 });
    });

    const response = await createGoogleLoginHandlers(
      existingDatabase as never,
      config,
    ).callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
      ),
    );

    expect(rollbackObserved).toBe(true);
    expect(response.status).toBe(303);
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it("rolls back an existing-user callback when policy acceptance persistence fails", async () => {
    let rollbackObserved = false;
    const transaction = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => {
            throw new Error("policy acceptance write failed");
          }),
        })),
      })),
    };
    const existingDatabase = {
      transaction: vi.fn(async (work: (value: object) => Promise<Response>) => {
        try {
          return await work(transaction);
        } catch (error) {
          rollbackObserved = true;
          throw error;
        }
      }),
    };
    getOAuthStateMock.mockResolvedValue({
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      policyAcceptedAt: "2026-07-26T00:00:00.000Z",
    });
    authHandler.mockImplementationOnce(async () => {
      const callbacks = createTransactionAuthMock.mock.calls.at(-1)?.[2] as {
        beforeGoogleSessionCreate(userId: string): Promise<void>;
      };
      await callbacks.beforeGoogleSessionCreate(
        "22222222-2222-4222-8222-222222222222",
      );
      return new Response(null, { status: 302 });
    });

    const response = await createGoogleLoginHandlers(
      existingDatabase as never,
      config,
    ).callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
      ),
    );

    expect(rollbackObserved).toBe(true);
    expect(response.status).toBe(303);
  });

  it("fails closed and rolls back a new Google user without current policy state", async () => {
    let rollbackObserved = false;
    const transaction = {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      execute: vi.fn(async () => undefined),
    };
    const onboardingDatabase = {
      transaction: vi.fn(async (work: (value: object) => Promise<Response>) => {
        try {
          return await work(transaction);
        } catch (error) {
          rollbackObserved = true;
          throw error;
        }
      }),
    };
    getOAuthStateMock.mockResolvedValue(null);
    authHandler.mockImplementationOnce(async () => {
      const callbacks = createTransactionAuthMock.mock.calls.at(-1)?.[2] as {
        beforeGoogleUserCreate(user: {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
        }): Promise<{ status: "active" }>;
      };
      await callbacks.beforeGoogleUserCreate({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Google Learner",
        email: "learner@example.test",
        emailVerified: true,
      });
      return new Response(null, { status: 302 });
    });

    const response = await createGoogleLoginHandlers(
      onboardingDatabase as never,
      config,
    ).callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
      ),
    );

    expect(rollbackObserved).toBe(true);
    expect(response.status).toBe(303);
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it("rolls back the OAuth account when an onboarding write fails", async () => {
    let rollbackObserved = false;
    let insertCount = 0;
    const transaction = {
      insert: vi.fn(() => {
        insertCount += 1;
        return {
          values: vi.fn(() =>
            insertCount === 2
              ? {
                  onConflictDoNothing: vi.fn(async () => {
                    throw new Error("policy write failed");
                  }),
                }
              : Promise.resolve(undefined),
          ),
        };
      }),
      execute: vi.fn(async () => undefined),
    };
    const onboardingDatabase = {
      transaction: vi.fn(async (work: (value: object) => Promise<Response>) => {
        try {
          return await work(transaction);
        } catch (error) {
          rollbackObserved = true;
          throw error;
        }
      }),
    };
    getOAuthStateMock.mockResolvedValue({
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      policyAcceptedAt: "2026-07-26T00:00:00.000Z",
    });
    authHandler.mockImplementationOnce(async () => {
      const callbacks = createTransactionAuthMock.mock.calls.at(-1)?.[2] as {
        beforeGoogleUserCreate(user: {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
        }): Promise<{ status: "active" }>;
        afterGoogleUserCreate(user: {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
        }): Promise<void>;
      };
      const user = {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Google Learner",
        email: "learner@example.test",
        emailVerified: true,
      };
      await callbacks.beforeGoogleUserCreate(user);
      await callbacks.afterGoogleUserCreate(user);
      return new Response(null, { status: 302 });
    });

    const response = await createGoogleLoginHandlers(
      onboardingDatabase as never,
      config,
    ).callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
      ),
    );

    expect(rollbackObserved).toBe(true);
    expect(response.status).toBe(303);
    expect(transaction.insert).toHaveBeenCalledTimes(2);
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  it("rejects cross-origin login starts before creating OAuth state", async () => {
    const handlers = createGoogleLoginHandlers(database() as never, config);

    const response = await handlers.start(
      new Request("https://learning.example.test/api/auth/google", {
        method: "POST",
        headers: { origin: "https://evil.example.test" },
      }),
    );

    expect(response.status).toBe(403);
    expect(signInSocial).not.toHaveBeenCalled();
  });

  it("fails closed when Google credentials are not configured", async () => {
    const handlers = createGoogleLoginHandlers(database() as never, {
      ...config,
      googleOAuth: undefined,
    });

    const response = await handlers.start(
      new Request("https://learning.example.test/api/auth/google", {
        method: "POST",
        headers: { origin: "https://learning.example.test" },
      }),
    );

    expect(response.status).toBe(404);
  });

  it("fails closed when Google policy configuration is incomplete", async () => {
    const loginDatabase = database();
    const handlers = createGoogleLoginHandlers(loginDatabase as never, {
      ...config,
      currentPolicies: undefined,
    });

    const startResponse = await handlers.start(
      new Request("https://learning.example.test/api/auth/google", {
        method: "POST",
        headers: { origin: "https://learning.example.test" },
      }),
    );
    const callbackResponse = await handlers.callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
      ),
    );

    expect(startResponse.status).toBe(404);
    expect(callbackResponse.status).toBe(404);
    expect(loginDatabase.transaction).not.toHaveBeenCalled();
  });

  it("delegates only the exact Google callback route to Better Auth", async () => {
    authHandler.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://learning.example.test/" },
      }),
    );
    const handlers = createGoogleLoginHandlers(database() as never, config);
    const request = new Request(
      "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
    );

    const response = await handlers.callback(request);

    expect(authHandler).toHaveBeenCalledWith(request);
    expect(createTransactionAuthMock).toHaveBeenLastCalledWith(
      expect.anything(),
      config,
      expect.anything(),
      { googleOAuthCallback: true },
    );
    expect(response.status).toBe(302);
  });

  it("rolls back a denied callback instead of retaining a linked factor", async () => {
    let rollbackObserved = false;
    const deniedDatabase = {
      transaction: vi.fn(
        async (work: (transaction: object) => Promise<Response>) => {
          try {
            return await work({});
          } catch (error) {
            rollbackObserved = true;
            throw error;
          }
        },
      ),
    };
    authHandler.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://learning.example.test/sign-in/google-error?error=denied",
        },
      }),
    );
    const handlers = createGoogleLoginHandlers(
      deniedDatabase as never,
      config,
    );

    const response = await handlers.callback(
      new Request(
        "https://learning.example.test/api/auth/callback/google?code=safe&state=safe",
      ),
    );

    expect(rollbackObserved).toBe(true);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://learning.example.test/sign-in/google-error",
    );
  });

  it("does not expose Better Auth handling on another callback path", async () => {
    const handlers = createGoogleLoginHandlers(database() as never, config);
    const response = await handlers.callback(
      new Request(
        "https://learning.example.test/api/auth/callback/not-google?code=safe",
      ),
    );

    expect(response.status).toBe(404);
    expect(authHandler).not.toHaveBeenCalled();
  });
});
