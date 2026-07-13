import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

let authInstance: NeonAuth | null | undefined;

export function isAuthConfigured() {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

export function getNeonAuth(): NeonAuth | null {
  if (authInstance !== undefined) {
    return authInstance;
  }

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret) {
    authInstance = null;
    return authInstance;
  }

  authInstance = createNeonAuth({
    baseUrl,
    cookies: {
      secret: cookieSecret,
      sessionDataTtl: 300,
      sameSite: "lax",
    },
    logLevel: process.env.NODE_ENV === "production" ? "warn" : "info",
  });

  return authInstance;
}

export function isLocalDemoMode() {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false";
}
