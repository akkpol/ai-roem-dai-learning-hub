import { isIP } from "node:net";

export type TrustedProxyBoundary = "vercel" | "none";

/**
 * Vercel overwrites the forwarded client IP before invoking a Function. Outside
 * that deployment boundary every caller-provided IP header is ignored and all
 * requests share a stable fail-closed rate-limit bucket.
 */
export function resolveClientIp(
  headers: Headers,
  trustedProxy: TrustedProxyBoundary,
): string {
  if (trustedProxy !== "vercel") return "untrusted-proxy";
  const candidate = headers.get("x-vercel-forwarded-for")?.trim();
  return candidate && isIP(candidate) ? candidate : "untrusted-proxy";
}
