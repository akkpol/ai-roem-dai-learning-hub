import { describe, expect, it } from "vitest";

import {
  assertRelativeCallbackPath,
  normalizeEmail,
  readCoreAuthConfig,
  readGoogleOAuthDisclosure,
  readIdentityConfig,
} from "@/modules/identity/config";

const valid = {
  AUTH_SECRET: "a".repeat(32),
  AUTH_BASE_URL: "https://learning.example.test/api/auth",
  AUTH_EMAIL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  AUTH_EMAIL_KEY_VERSION: "auth-email-v1",
  AUTH_EMAIL_FROM: "Learning Hub <auth@learn.example.test>",
};

describe("Identity configuration", () => {
  it("reads only core auth settings for the unified Google flow", () => {
    const coreOnly = {
      AUTH_SECRET: "a".repeat(32),
      AUTH_BASE_URL: "https://learning.example.test/api/auth",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    };

    expect(readCoreAuthConfig(coreOnly)).toEqual({
      authSecret: "a".repeat(32),
      baseUrl: "https://learning.example.test/api/auth",
      googleOAuth: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      },
      currentPolicies: {
        termsVersion: "2026-07-26",
        privacyVersion: "2026-07-26",
        termsUrl: "/terms",
        privacyUrl: "/privacy",
      },
      trustedProxy: "none",
    });
    expect(
      readCoreAuthConfig({ ...coreOnly, VERCEL: "1" }).trustedProxy,
    ).toBe("vercel");
    expect(
      readCoreAuthConfig({
        AUTH_SECRET: coreOnly.AUTH_SECRET,
        AUTH_BASE_URL: coreOnly.AUTH_BASE_URL,
      }).googleOAuth,
    ).toBeUndefined();

    // Full identity routes keep their existing fail-closed requirements.
    expect(() => readIdentityConfig(coreOnly)).toThrow(
      "identity configuration is invalid",
    );
  });

  it("keeps core auth secrets, base URL, and Google credential pairing strict", () => {
    const coreOnly = {
      AUTH_SECRET: "a".repeat(32),
      AUTH_BASE_URL: "https://learning.example.test/api/auth",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    };

    expect(() =>
      readCoreAuthConfig({ ...coreOnly, AUTH_SECRET: "weak" }),
    ).toThrow("identity configuration is invalid");
    expect(() =>
      readCoreAuthConfig({
        ...coreOnly,
        AUTH_BASE_URL: "https://learning.example.test/not-auth",
      }),
    ).toThrow("identity configuration is invalid");
    expect(() =>
      readCoreAuthConfig({
        ...coreOnly,
        GOOGLE_CLIENT_SECRET: undefined,
      }),
    ).toThrow("identity configuration is invalid");
    expect(() =>
      readCoreAuthConfig({
        ...coreOnly,
        GOOGLE_CLIENT_ID: undefined,
      }),
    ).toThrow("identity configuration is invalid");
  });

  it("uses the published code-owned policy for Google OAuth", () => {
    const google = {
      AUTH_SECRET: "a".repeat(32),
      AUTH_BASE_URL: "https://learning.example.test/api/auth",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    };

    expect(
      readGoogleOAuthDisclosure({
        ...google,
        AUTH_TERMS_URL: "https://untrusted.example/terms",
      }),
    ).toEqual({
      termsUrl: "/terms",
      privacyUrl: "/privacy",
    });
  });

  it("reads validated auth and policy configuration", () => {
    const config = readIdentityConfig(valid);
    expect(config.authSecret).toHaveLength(32);
    expect(config.emailEncryptionKey).toHaveLength(32);
    expect(config.termsVersion).toBe("2026-07-26");
    expect(config.trustedProxy).toBe("none");
    expect(readIdentityConfig({ ...valid, VERCEL: "1" }).trustedProxy).toBe(
      "vercel",
    );
  });

  it("enables Google OAuth only when both provider credentials are present", () => {
    const config = readIdentityConfig({
      ...valid,
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    });

    expect(config.googleOAuth).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    });
    expect(readIdentityConfig(valid).googleOAuth).toBeUndefined();
    expect(() =>
      readIdentityConfig({
        ...valid,
        GOOGLE_CLIENT_ID: "google-client-id",
      }),
    ).toThrow("identity configuration is invalid");
    expect(() =>
      readIdentityConfig({
        ...valid,
        GOOGLE_CLIENT_SECRET: "google-client-secret",
      }),
    ).toThrow("identity configuration is invalid");
  });

  it("rejects weak secret and malformed encryption keys without echoing them", () => {
    expect(() =>
      readIdentityConfig({
        ...valid,
        AUTH_SECRET: "weak",
        AUTH_EMAIL_ENCRYPTION_KEY: "plaintext-key",
      }),
    ).toThrow();
    try {
      readIdentityConfig({ ...valid, AUTH_EMAIL_ENCRYPTION_KEY: "plaintext-key" });
    } catch (error) {
      expect(String(error)).not.toContain("plaintext-key");
    }
  });

  it("normalizes email and accepts only same-origin relative callback paths", () => {
    expect(normalizeEmail("  User@Example.TEST ")).toBe("user@example.test");
    expect(assertRelativeCallbackPath("/account")).toBe("/account");
    expect(() => assertRelativeCallbackPath("https://evil.example/x")).toThrow(
      "callback path is not allowed",
    );
    expect(() => assertRelativeCallbackPath("//evil.example/x")).toThrow(
      "callback path is not allowed",
    );
  });
});
