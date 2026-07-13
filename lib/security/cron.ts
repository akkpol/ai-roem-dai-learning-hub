import { createHmac, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHmac("sha256", "ai-roem-dai-cron-auth").update(value).digest();
}

export function isValidCronAuthorization(
  authorization: string | null,
  expectedSecret: string | undefined,
) {
  if (!authorization?.startsWith("Bearer ") || !expectedSecret) {
    return false;
  }

  const supplied = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(supplied), digest(expectedSecret));
}
