import { describe, expect, it } from "vitest";

import { parseSignUpCommand } from "@/modules/identity/contracts";

const policies = {
  termsVersion: "terms-2026-07",
  privacyVersion: "privacy-2026-07",
};

describe("Signup command", () => {
  it("normalizes valid input and binds current policy versions", () => {
    const command = parseSignUpCommand(
      {
        displayName: "  ผู้เรียนใหม่  ",
        email: " New.User@Example.TEST ",
        password: "correct-horse-battery-staple",
        ageAttested: true,
        termsVersion: policies.termsVersion,
        privacyVersion: policies.privacyVersion,
        callbackPath: "/verify-email",
      },
      policies,
    );
    expect(command.email).toBe("new.user@example.test");
    expect(command.displayName).toBe("ผู้เรียนใหม่");
  });

  it("rejects missing age attestation and stale policy forms", () => {
    expect(() =>
      parseSignUpCommand(
        {
          displayName: "Learner",
          email: "learner@example.test",
          password: "correct-horse-battery-staple",
          ageAttested: false,
          termsVersion: "old-terms",
          privacyVersion: policies.privacyVersion,
          callbackPath: "/verify-email",
        },
        policies,
      ),
    ).toThrow("signup input is invalid");
  });

  it("does not include passwords in validation errors", () => {
    const password = "secret-that-must-not-escape";
    try {
      parseSignUpCommand(
        {
          displayName: "",
          email: "invalid",
          password,
          ageAttested: true,
          termsVersion: policies.termsVersion,
          privacyVersion: policies.privacyVersion,
          callbackPath: "https://evil.example",
        },
        policies,
      );
    } catch (error) {
      expect(String(error)).not.toContain(password);
    }
  });
});
