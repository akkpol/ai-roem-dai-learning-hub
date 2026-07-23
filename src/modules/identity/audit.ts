import type { DatabaseTransaction } from "@/platform/database/transaction";

import { identityAuditEvents } from "./schema";

const secretKey =
  /(?:password|token|secret|recovery[_-]?code|backup[_-]?code|authorization|cookie)/i;

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
  await transaction.insert(identityAuditEvents).values({
    accountId: input.targetAccountId,
    actorType: input.actor.type,
    actorAccountId:
      input.actor.type === "account" ? input.actor.accountId : null,
    action: input.action,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: redactAuditPayload(input.payload ?? {}),
    occurredAt: input.occurredAt ?? new Date(),
  });
}
