import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";

import type { AppDatabase } from "@/platform/database/client";

import { identityRateLimits } from "./schema";

export type RateLimitDecision = { allowed: boolean; retryAfter: number };

export function deriveIdentityRateLimitKey(
  secret: string,
  endpoint: string,
  clientId: string,
): string {
  return createHmac("sha256", secret)
    .update(`${endpoint}:${clientId}`)
    .digest("hex");
}

export async function consumeIdentityRateLimit(
  database: AppDatabase,
  secret: string,
  endpoint: string,
  clientIp: string,
  rule: { windowSeconds: number; max: number },
  now = Date.now(),
): Promise<RateLimitDecision> {
  const key = deriveIdentityRateLimitKey(secret, endpoint, clientIp);
  const cutoff = now - rule.windowSeconds * 1_000;
  const rows = await database
    .insert(identityRateLimits)
    .values({ key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: identityRateLimits.key,
      set: {
        count: sql`case when ${identityRateLimits.lastRequest} <= ${cutoff} then 1 else ${identityRateLimits.count} + 1 end`,
        lastRequest: sql`case when ${identityRateLimits.lastRequest} <= ${cutoff} then ${now} else ${identityRateLimits.lastRequest} end`,
      },
    })
    .returning({
      count: identityRateLimits.count,
      windowStartedAt: identityRateLimits.lastRequest,
    });
  const row = rows[0];
  if (!row) throw new Error("identity rate limit unavailable");
  return {
    allowed: row.count <= rule.max,
    retryAfter: Math.max(
      1,
      Math.ceil((row.windowStartedAt + rule.windowSeconds * 1_000 - now) / 1_000),
    ),
  };
}
