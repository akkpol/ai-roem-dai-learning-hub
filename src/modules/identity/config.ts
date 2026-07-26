import { z } from "zod";

import { currentIdentityPolicies } from "@/modules/identity/policies";
import type { TrustedProxyBoundary } from "@/platform/security/client-ip";

const coreAuthEnvironmentShape = {
  AUTH_SECRET: z.string().min(32),
  AUTH_BASE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
};

function hasPairedGoogleCredentials(value: {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}): boolean {
  return Boolean(value.GOOGLE_CLIENT_ID) === Boolean(value.GOOGLE_CLIENT_SECRET);
}

const googleCredentialPairIssue = {
  message: "Google OAuth credentials must be configured as a pair",
};

const coreAuthEnvironment = z
  .object(coreAuthEnvironmentShape)
  .refine(hasPairedGoogleCredentials, googleCredentialPairIssue);

const identityEnvironment = z
  .object({
    ...coreAuthEnvironmentShape,
    AUTH_EMAIL_ENCRYPTION_KEY: z.string().min(1),
    AUTH_EMAIL_KEY_VERSION: z.string().min(1).max(64),
    AUTH_EMAIL_FROM: z.string().min(3).max(320),
    RESEND_API_KEY: z.string().min(1).optional(),
  })
  .refine(hasPairedGoogleCredentials, googleCredentialPairIssue);

export type CoreAuthConfig = {
  authSecret: string;
  baseUrl: string;
  googleOAuth?: {
    clientId: string;
    clientSecret: string;
  };
  currentPolicies?: {
    termsVersion: string;
    privacyVersion: string;
    termsUrl: string;
    privacyUrl: string;
  };
  trustedProxy: TrustedProxyBoundary;
};

export type GoogleAuthConfig = CoreAuthConfig;

export type IdentityConfig = CoreAuthConfig & {
  emailEncryptionKey: Buffer;
  emailKeyVersion: string;
  termsVersion: string;
  privacyVersion: string;
  emailFrom: string;
  resendApiKey?: string;
};

function toCoreAuthConfig(
  value: z.infer<typeof coreAuthEnvironment>,
  input: Record<string, string | undefined>,
): CoreAuthConfig {
  const parsedBaseUrl = new URL(value.AUTH_BASE_URL);
  if (parsedBaseUrl.pathname.replace(/\/$/, "") !== "/api/auth") {
    throw new Error("identity configuration is invalid");
  }
  return {
    authSecret: value.AUTH_SECRET,
    baseUrl: parsedBaseUrl.href.replace(/\/$/, ""),
    googleOAuth:
      value.GOOGLE_CLIENT_ID && value.GOOGLE_CLIENT_SECRET
        ? {
            clientId: value.GOOGLE_CLIENT_ID,
            clientSecret: value.GOOGLE_CLIENT_SECRET,
          }
        : undefined,
    currentPolicies: {
      termsVersion: currentIdentityPolicies.termsVersion,
      privacyVersion: currentIdentityPolicies.privacyVersion,
      termsUrl: currentIdentityPolicies.termsUrl,
      privacyUrl: currentIdentityPolicies.privacyUrl,
    },
    trustedProxy: input.VERCEL === "1" ? "vercel" : "none",
  };
}

export function readCoreAuthConfig(
  input: Record<string, string | undefined>,
): CoreAuthConfig {
  try {
    return toCoreAuthConfig(coreAuthEnvironment.parse(input), input);
  } catch {
    throw new Error("identity configuration is invalid");
  }
}

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
  return {
    ...toCoreAuthConfig(value, input),
    emailEncryptionKey: key,
    emailKeyVersion: value.AUTH_EMAIL_KEY_VERSION,
    termsVersion: currentIdentityPolicies.termsVersion,
    privacyVersion: currentIdentityPolicies.privacyVersion,
    emailFrom: value.AUTH_EMAIL_FROM,
    resendApiKey: value.RESEND_API_KEY,
  };
}

export type GoogleOAuthDisclosure = {
  termsUrl: string;
  privacyUrl: string;
};

export function readGoogleOAuthDisclosure(
  input: Record<string, string | undefined>,
): GoogleOAuthDisclosure | undefined {
  try {
    const config = readCoreAuthConfig(input);
    if (!config.googleOAuth || !config.currentPolicies) return undefined;
    return {
      termsUrl: config.currentPolicies.termsUrl,
      privacyUrl: config.currentPolicies.privacyUrl,
    };
  } catch {
    return undefined;
  }
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
