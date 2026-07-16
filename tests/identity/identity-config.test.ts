import { describe, expect, it } from "vitest";

import {
  assertRelativeCallbackPath,
  normalizeEmail,
  readIdentityConfig,
} from "@/modules/identity/config";

const valid = {
  AUTH_SECRET: "a".repeat(32),
  AUTH_BASE_URL: "https://learning.example.test/api/auth",
  AUTH_EMAIL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  AUTH_EMAIL_KEY_VERSION: "auth-email-v1",
  AUTH_TERMS_VERSION: "terms-2026-07",
  AUTH_PRIVACY_VERSION: "privacy-2026-07",
  AUTH_EMAIL_FROM: "Learning Hub <auth@learn.example.test>",
};

describe("Identity configuration", () => {
  it("reads validated auth and policy configuration", () => {
    const config = readIdentityConfig(valid);
    expect(config.authSecret).toHaveLength(32);
    expect(config.emailEncryptionKey).toHaveLength(32);
    expect(config.termsVersion).toBe("terms-2026-07");
    expect(config.trustedProxy).toBe("none");
    expect(readIdentityConfig({ ...valid, VERCEL: "1" }).trustedProxy).toBe(
      "vercel",
    );
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
