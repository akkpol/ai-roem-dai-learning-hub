import { describe, expect, it } from "vitest";

import {
  parsePasswordChange,
  parseProfileUpdate,
  parseSecondFactorProof,
} from "@/modules/identity/account-contracts";
import { optionalSecondFactorProof } from "@/modules/identity/account-http";

describe("SESSION-004 account input contracts", () => {
  it("accepts only the approved profile fields", () => {
    expect(
      parseProfileUpdate({
        displayName: " ผู้เรียน ",
        locale: "th-TH",
        timeZone: "Asia/Bangkok",
      }),
    ).toEqual({
      displayName: "ผู้เรียน",
      locale: "th-TH",
      timeZone: "Asia/Bangkok",
    });
    expect(() =>
      parseProfileUpdate({
        displayName: "Learner",
        locale: "en-US",
        timeZone: "UTC",
        email: "attacker@example.test",
      }),
    ).toThrow("profile input is invalid");
  });

  it("requires a strong new password distinct from the current password", () => {
    expect(
      parsePasswordChange({
        currentPassword: "old-password-123",
        newPassword: "new-password-456",
      }),
    ).toEqual({
      currentPassword: "old-password-123",
      newPassword: "new-password-456",
    });
    expect(() =>
      parsePasswordChange({
        currentPassword: "same-password-123",
        newPassword: "same-password-123",
      }),
    ).toThrow("password change is invalid");
  });

  it("uses exactly one second-factor proof and never enables trust", () => {
    expect(parseSecondFactorProof({ totpCode: "123456" })).toEqual({
      kind: "totp",
      code: "123456",
    });
    expect(parseSecondFactorProof({ recoveryCode: "abc-def" })).toEqual({
      kind: "recovery",
      code: "abc-def",
    });
    expect(() =>
      parseSecondFactorProof({ totpCode: "123456", recoveryCode: "abc-def" }),
    ).toThrow("second factor is invalid");
  });

  it("extracts second-factor fields from secure-action forms", () => {
    expect(
      optionalSecondFactorProof({ totpCode: "123456", recoveryCode: undefined }),
    ).toEqual({ kind: "totp", code: "123456" });
    expect(optionalSecondFactorProof({})).toBeUndefined();
  });
});
