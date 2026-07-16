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
  it("ignores spoofable forwarded chains and accepts a trusted single-hop IP", () => {
    expect(
      resolveClientIp(
        new Headers({
          "x-forwarded-for": "198.51.100.1, 203.0.113.2",
          "x-real-ip": "192.0.2.10",
        }),
      ),
    ).toBe("192.0.2.10");
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
        headers: { "content-type": "application/json", "x-real-ip": "192.0.2.1" },
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
        headers: { "content-type": "application/json" },
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
});
