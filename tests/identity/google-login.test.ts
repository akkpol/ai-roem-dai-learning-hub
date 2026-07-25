import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityConfig } from "@/modules/identity/config";
import { createGoogleLoginHandlers } from "@/modules/identity/google-login";

const { signInSocial, authHandler, createTransactionAuthMock } = vi.hoisted(
  () => {
    const signInSocial = vi.fn();
    const authHandler = vi.fn();
    return {
      signInSocial,
      authHandler,
      createTransactionAuthMock: vi.fn(() => ({
        api: { signInSocial },
        handler: authHandler,
      })),
    };
  },
);

vi.mock("@/modules/identity/auth", () => ({
  createTransactionAuth: createTransactionAuthMock,
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
        callbackURL: "/",
        errorCallbackURL: "/sign-in/google-error",
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
