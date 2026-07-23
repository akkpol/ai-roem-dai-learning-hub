import { sql } from "drizzle-orm";

import type { DatabaseTransaction } from "@/platform/database/transaction";

import { identityAuditEvents } from "./schema";

const secretKey =
  /(?:password|token|secret|recovery[_-]?code|backup[_-]?code|authorization|cookie|credential|encrypted(?:[_-]?payload)?|email)/i;
const secretValue =
  /(?:[^\s@]+@[^\s@]+\.[^\s@]+|^(?:raw[-_ ]?)?(?:session[-_ ]?token|verification[-_ ]?token|totp[-_ ]?secret|recovery[-_ ]?code|backup[-_ ]?code|encrypted[-_ ]?payload|credential)(?:[-_ ].*)?$|^super[-_ ]?secret[-_ ]?password$)/i;

export type AuditActor =
  | { type: "account"; accountId: string }
  | {
      type: "system:bootstrap" | "system:break-glass" | "system:maintenance";
    };

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        secretKey.test(key) ? "[REDACTED]" : redactValue(nested),
      ]),
    );
  }
  if (typeof value === "string" && secretValue.test(value)) {
    return "[REDACTED]";
  }
  return value;
}

export function redactAuditPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return redactValue(payload) as Record<string, unknown>;
}

export async function appendIdentityAudit(
  transaction: DatabaseTransaction,
  input: {
    targetAccountId: string;
    actor: AuditActor;
    action: string;
    reasonCode?: string;
    correlationId?: string;
    payload?: Record<string, unknown>;
    occurredAt?: Date;
  },
): Promise<void> {
  const payload = redactAuditPayload(input.payload ?? {});
  const occurredAt = input.occurredAt ?? new Date();
  if (input.actor.type === "account") {
    await transaction.execute(sql`
      select identity_append_account_audit(
        ${input.targetAccountId}::uuid,
        ${input.actor.accountId}::uuid,
        ${input.action}::text,
        ${input.reasonCode ?? null}::text,
        ${input.correlationId ?? null}::text,
        ${JSON.stringify(payload)}::jsonb
      )
    `);
    return;
  }
  await transaction.insert(identityAuditEvents).values({
    accountId: input.targetAccountId,
    actorType: input.actor.type,
    actorAccountId: null,
    action: input.action,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload,
    occurredAt,
  });
}
