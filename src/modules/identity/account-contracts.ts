import { z } from "zod";

const password = z.string().min(12).max(128);

export type ProfileUpdate = {
  displayName: string;
  locale: "th-TH" | "en-US";
  timeZone: string;
};

export function parseProfileUpdate(input: unknown): ProfileUpdate {
  try {
    return z
      .object({
        displayName: z.string().trim().min(1).max(120),
        locale: z.enum(["th-TH", "en-US"]),
        timeZone: z.string().trim().min(1).max(100).refine((value) => {
          try {
            new Intl.DateTimeFormat("en-US", { timeZone: value });
            return true;
          } catch {
            return false;
          }
        }),
      })
      .strict()
      .parse(input);
  } catch {
    throw new Error("profile input is invalid");
  }
}

export function parsePasswordChange(input: unknown) {
  try {
    return z
      .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
      .strict()
      .refine((value) => value.currentPassword !== value.newPassword)
      .parse(input);
  } catch {
    throw new Error("password change is invalid");
  }
}

export type SecondFactorProof =
  | { kind: "totp"; code: string }
  | { kind: "recovery"; code: string };

export function parseSecondFactorProof(input: unknown): SecondFactorProof {
  try {
    const value = z
      .object({
        totpCode: z.string().regex(/^\d{6}$/).optional(),
        recoveryCode: z.string().trim().min(6).max(128).optional(),
      })
      .strict()
      .refine((candidate) => Number(Boolean(candidate.totpCode)) + Number(Boolean(candidate.recoveryCode)) === 1)
      .parse(input);
    return value.totpCode
      ? { kind: "totp", code: value.totpCode }
      : { kind: "recovery", code: value.recoveryCode! };
  } catch {
    throw new Error("second factor is invalid");
  }
}
