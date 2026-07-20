import { z } from "zod";

const password = z.string().min(12).max(128);

export class AccountInputError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
    this.name = "AccountInputError";
  }
}

const fieldMessages: Record<string, string> = {
  displayName: "กรุณากรอกชื่อที่แสดงไม่เกิน 120 ตัวอักษร",
  locale: "กรุณาเลือกภาษา th-TH หรือ en-US",
  timeZone: "กรุณากรอกชื่อเขตเวลา IANA ที่ถูกต้อง",
  currentPassword: "กรุณากรอกรหัสผ่านปัจจุบัน",
  newPassword: "รหัสผ่านใหม่ต้องมี 12 ถึง 128 ตัวอักษรและไม่ซ้ำรหัสเดิม",
  totpCode: "กรุณากรอกรหัส TOTP 6 หลัก",
  recoveryCode: "กรุณากรอกรหัสกู้คืนที่ถูกต้อง",
};

function inputError(error: unknown, message: string) {
  if (!(error instanceof z.ZodError)) {
    return new AccountInputError(message, { _form: "ข้อมูลที่ส่งมาไม่ถูกต้อง" });
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_form");
    fieldErrors[field] ??= fieldMessages[field] ?? "ข้อมูลช่องนี้ไม่ถูกต้อง";
  }
  return new AccountInputError(message, fieldErrors);
}

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
  } catch (error) {
    throw inputError(error, "profile input is invalid");
  }
}

export function parsePasswordChange(input: unknown) {
  try {
    return z
      .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
      .strict()
      .refine((value) => value.currentPassword !== value.newPassword, { path: ["newPassword"] })
      .parse(input);
  } catch (error) {
    throw inputError(error, "password change is invalid");
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
      .refine(
        (candidate) => Number(Boolean(candidate.totpCode)) + Number(Boolean(candidate.recoveryCode)) === 1,
        { path: ["totpCode"] },
      )
      .parse(input);
    return value.totpCode
      ? { kind: "totp", code: value.totpCode }
      : { kind: "recovery", code: value.recoveryCode! };
  } catch (error) {
    throw inputError(error, "second factor is invalid");
  }
}
