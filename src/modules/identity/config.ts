import { z } from "zod";

import type { TrustedProxyBoundary } from "@/platform/security/client-ip";

const identityEnvironment = z.object({
  AUTH_SECRET: z.string().min(32),
  AUTH_BASE_URL: z.string().url(),
  AUTH_EMAIL_ENCRYPTION_KEY: z.string().min(1),
  AUTH_EMAIL_KEY_VERSION: z.string().min(1).max(64),
  AUTH_TERMS_VERSION: z.string().min(1).max(100),
  AUTH_PRIVACY_VERSION: z.string().min(1).max(100),
  AUTH_EMAIL_FROM: z.string().min(3).max(320),
  RESEND_API_KEY: z.string().min(1).optional(),
});

export type IdentityConfig = {
  authSecret: string;
  baseUrl: string;
  emailEncryptionKey: Buffer;
  emailKeyVersion: string;
  termsVersion: string;
  privacyVersion: string;
  emailFrom: string;
  resendApiKey?: string;
  trustedProxy: TrustedProxyBoundary;
};

export function readIdentityConfig(
  input: Record<string, string | undefined>,
): IdentityConfig {
  let value: z.infer<typeof identityEnvironment>;
  try {
    value = identityEnvironment.parse(input);
  } catch {
    throw new Error("identity configuration is invalid");
  }
  const key = Buffer.from(value.AUTH_EMAIL_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("identity configuration is invalid");
  }
  const parsedBaseUrl = new URL(value.AUTH_BASE_URL);
  if (parsedBaseUrl.pathname.replace(/\/$/, "") !== "/api/auth") {
    throw new Error("identity configuration is invalid");
  }
  return {
    authSecret: value.AUTH_SECRET,
    baseUrl: parsedBaseUrl.href.replace(/\/$/, ""),
    emailEncryptionKey: key,
    emailKeyVersion: value.AUTH_EMAIL_KEY_VERSION,
    termsVersion: value.AUTH_TERMS_VERSION,
    privacyVersion: value.AUTH_PRIVACY_VERSION,
    emailFrom: value.AUTH_EMAIL_FROM,
    resendApiKey: value.RESEND_API_KEY,
    trustedProxy: input.VERCEL === "1" ? "vercel" : "none",
  };
}
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertRelativeCallbackPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("callback path is not allowed");
  }
  const parsed = new URL(path, "https://learning-hub.invalid");
  if (parsed.origin !== "https://learning-hub.invalid") {
    throw new Error("callback path is not allowed");
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
