import { z } from "zod";

import { assertRelativeCallbackPath, normalizeEmail } from "./config";

const email = z.string().trim().email().max(320).transform(normalizeEmail);
const password = z.string().min(12).max(128);

export type CurrentPolicyVersions = {
  termsVersion: string;
  privacyVersion: string;
};

export type SignUpCommand = {
  displayName: string;
  email: string;
  password: string;
  acceptedAt: Date;
  termsVersion: string;
  privacyVersion: string;
  callbackPath: string;
};

export const genericAuthMessage =
  "หากข้อมูลถูกต้อง ระบบจะดำเนินการตามคำขอของคุณ";

export function parseSignUpCommand(
  input: unknown,
  currentPolicies: CurrentPolicyVersions,
  now = new Date(),
): SignUpCommand {
  try {
    const value = z
      .object({
        displayName: z.string().trim().min(1).max(120),
        email,
        password,
        termsVersion: z.literal(currentPolicies.termsVersion),
        privacyVersion: z.literal(currentPolicies.privacyVersion),
        callbackPath: z.string().transform(assertRelativeCallbackPath),
      })
      .parse(input);
    return {
      displayName: value.displayName,
      email: value.email,
      password: value.password,
      acceptedAt: now,
      termsVersion: value.termsVersion,
      privacyVersion: value.privacyVersion,
      callbackPath: value.callbackPath,
    };
  } catch {
    throw new Error("signup input is invalid");
  }
}

export function parseSignInCommand(input: unknown) {
  try {
    return z
      .object({
        email,
        password: z.string().min(1).max(128),
        callbackPath: z.string().transform(assertRelativeCallbackPath).default("/"),
      })
      .parse(input);
  } catch {
    throw new Error("sign-in input is invalid");
  }
}

export function parseResetRequestCommand(input: unknown) {
  try {
    return z
      .object({
        email,
        redirectPath: z
          .string()
          .transform(assertRelativeCallbackPath)
          .default("/reset-password"),
      })
      .parse(input);
  } catch {
    throw new Error("password-reset request is invalid");
  }
}

export function parseResetPasswordCommand(input: unknown) {
  try {
    return z.object({ token: z.string().min(1).max(512), newPassword: password }).parse(input);
  } catch {
    throw new Error("password reset is invalid");
  }
}
