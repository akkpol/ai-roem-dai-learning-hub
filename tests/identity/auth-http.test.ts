import { describe, expect, it, vi } from "vitest";

import { createAuthHttpHandlers } from "@/modules/identity/http";
import { resolveClientIp } from "@/platform/security/client-ip";

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

function fakeService() {
  return {
    signUp: vi.fn(async () => ({ status: true as const, message: "generic" })),
    verifyEmail: vi.fn(async () => ({ status: true as const, message: "generic" })),
    signIn: vi.fn(async () => ({
      status: 200,
      headers: new Headers({ "set-cookie": "session=safe; HttpOnly" }),
      body: { status: true as const, message: "generic" },
    })),
    signOut: vi.fn(async () => ({
      status: 200,
      headers: new Headers(),
      body: { status: true as const, message: "generic" },
    })),
    requestPasswordReset: vi.fn(async () => ({
      status: true as const,
      message: "generic",
    })),
    resetPassword: vi.fn(async () => ({
      status: 200,
      body: { status: true as const, message: "generic" },
    })),
  };
}

describe("Authentication HTTP boundary", () => {
  it("ignores caller-provided IP headers outside the Vercel boundary", () => {
    expect(
      resolveClientIp(
        new Headers({
          "x-forwarded-for": "198.51.100.1, 203.0.113.2",
          "x-real-ip": "192.0.2.10",
          "x-vercel-forwarded-for": "203.0.113.9",
        }),
        "none",
      ),
    ).toBe("untrusted-proxy");
  });

  it("uses only Vercel's overwritten single-client header at the trusted boundary", () => {
    expect(
      resolveClientIp(
        new Headers({
          "x-real-ip": "192.0.2.10",
          "x-vercel-forwarded-for": "203.0.113.9",
        }),
        "vercel",
      ),
    ).toBe("203.0.113.9");
    expect(
      resolveClientIp(
        new Headers({ "x-vercel-forwarded-for": "203.0.113.9, 192.0.2.1" }),
        "vercel",
      ),
    ).toBe("untrusted-proxy");
  });

  it("rate limits forgot-password before calling the orchestrator", async () => {
    const service = fakeService();
    const handlers = createAuthHttpHandlers({
      service,
      config,
      consumeRateLimit: vi.fn(async () => ({ allowed: false, retryAfter: 42 })),
    });
    const response = await handlers.forgotPassword(
      new Request("https://learning.example.test/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://learning.example.test",
          "x-real-ip": "192.0.2.1",
        },
        body: JSON.stringify({ email: "unknown@example.test" }),
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(service.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("forwards sign-in cookies without exposing credential details", async () => {
    const service = fakeService();
    const handlers = createAuthHttpHandlers({
      service,
      config,
      consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
    });
    const response = await handlers.signIn(
      new Request("https://learning.example.test/api/auth/sign-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://learning.example.test",
        },
        body: JSON.stringify({
          email: "user@example.test",
          password: "not-returned-to-client",
          callbackPath: "/",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.text()).not.toContain("not-returned-to-client");
  });

  it("redirects verified email only to an allowed relative page", async () => {
    const service = fakeService();
    const handlers = createAuthHttpHandlers({
      service,
      config,
      consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
    });
    const success = await handlers.verifyEmail(
      new Request(
        "https://learning.example.test/api/auth/verify-email?token=safe&callbackURL=%2Fverify-email%3Fverified%3D1",
      ),
    );
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toBe(
      "https://learning.example.test/verify-email?verified=1",
    );

    const rejected = await handlers.verifyEmail(
      new Request(
        "https://learning.example.test/api/auth/verify-email?token=safe&callbackURL=https%3A%2F%2Fevil.example",
      ),
    );
    expect(rejected.status).toBe(400);
  });

  it("anchors verification redirects to AUTH_BASE_URL and rejects a hostile request host", async () => {
    const service = fakeService();
    const handlers = createAuthHttpHandlers({
      service,
      config,
      consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
    });
    const response = await handlers.verifyEmail(
      new Request(
        "https://evil.example/api/auth/verify-email?token=safe&callbackURL=%2Fverify-email",
      ),
    );

    expect(response.status).toBe(403);
    expect(service.verifyEmail).not.toHaveBeenCalled();

    const hostileHost = await handlers.verifyEmail(
      new Request(
        "https://learning.example.test/api/auth/verify-email?token=safe&callbackURL=%2Fverify-email",
        { headers: { host: "evil.example" } },
      ),
    );
    expect(hostileHost.status).toBe(403);
    expect(service.verifyEmail).not.toHaveBeenCalled();
  });

  it("rejects a foreign Origin before authentication", async () => {
    const service = fakeService();
    const handlers = createAuthHttpHandlers({
      service,
      config,
      consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
    });
    const response = await handlers.signIn(
      new Request("https://learning.example.test/api/auth/sign-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          email: "user@example.test",
          password: "not-returned-to-client",
          callbackPath: "/",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(service.signIn).not.toHaveBeenCalled();
  });

  it("rejects a missing Origin unless Fetch Metadata proves same-origin", async () => {
    const service = fakeService();
    const handlers = createAuthHttpHandlers({
      service,
      config,
      consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
    });
    const body = JSON.stringify({
      email: "user@example.test",
      password: "not-returned-to-client",
      callbackPath: "/",
    });
    const missing = await handlers.signIn(
      new Request("https://learning.example.test/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    const sameOriginMetadata = await handlers.signIn(
      new Request("https://learning.example.test/api/auth/sign-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body,
      }),
    );

    expect(missing.status).toBe(403);
    expect(sameOriginMetadata.status).toBe(200);
    expect(service.signIn).toHaveBeenCalledTimes(1);
  });

  it("uses an unrotatable fallback key and exactly 3 requests per 60 seconds for signup", async () => {
    const service = fakeService();
    const consumeRateLimit = vi.fn(async () => ({ allowed: true, retryAfter: 0 }));
    const handlers = createAuthHttpHandlers({ service, config, consumeRateLimit });
    const request = (spoofedIp: string) =>
      handlers.signUp(
        new Request("https://learning.example.test/api/auth/sign-up", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://learning.example.test",
            "x-real-ip": spoofedIp,
          },
          body: JSON.stringify({
            displayName: "Learner",
            email: "learner@example.test",
            password: "correct-horse-battery-staple",
            ageAttested: true,
            termsVersion: "terms-v1",
            privacyVersion: "privacy-v1",
            callbackPath: "/verify-email",
          }),
        }),
      );

    await request("192.0.2.1");
    await request("192.0.2.2");

    expect(consumeRateLimit).toHaveBeenNthCalledWith(1, {
      endpoint: "sign-up",
      clientIp: "untrusted-proxy",
      windowSeconds: 60,
      max: 3,
    });
    expect(consumeRateLimit).toHaveBeenNthCalledWith(2, {
      endpoint: "sign-up",
      clientIp: "untrusted-proxy",
      windowSeconds: 60,
      max: 3,
    });
  });

  it("does not misclassify an unrelated signup operational failure as invalid input", async () => {
    const service = fakeService();
    service.signUp.mockRejectedValueOnce(new Error("database unavailable"));
    const handlers = createAuthHttpHandlers({
      service,
      config,
      consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
    });
    const response = await handlers.signUp(
      new Request("https://learning.example.test/api/auth/sign-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://learning.example.test",
        },
        body: JSON.stringify({
          displayName: "Learner",
          email: "learner@example.test",
          password: "correct-horse-battery-staple",
          ageAttested: true,
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          callbackPath: "/verify-email",
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("database unavailable");
  });

  it("does not pass the raw trusted client IP into Identity persistence", async () => {
    const service = fakeService();
    const handlers = createAuthHttpHandlers({
      service,
      config: { ...config, trustedProxy: "vercel" },
      consumeRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
    });
    await handlers.signUp(
      new Request("https://learning.example.test/api/auth/sign-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://learning.example.test",
          "x-vercel-forwarded-for": "203.0.113.44",
        },
        body: JSON.stringify({
          displayName: "Learner",
          email: "learner@example.test",
          password: "correct-horse-battery-staple",
          ageAttested: true,
          termsVersion: "terms-v1",
          privacyVersion: "privacy-v1",
          callbackPath: "/verify-email",
        }),
      }),
    );

    expect(service.signUp).toHaveBeenCalledWith(
      expect.any(Object),
      { userAgent: undefined },
    );
  });
});
