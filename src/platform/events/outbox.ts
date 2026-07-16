import { sql } from "drizzle-orm";

import type { DatabaseTransaction } from "@/platform/database/transaction";

import type { DomainEventInput } from "./domain-event";
import { platformEventConsumptions, platformEventOutbox } from "./schema";

export async function enqueueDomainEvent(
  tx: DatabaseTransaction,
  input: DomainEventInput,
): Promise<string> {
  const id = crypto.randomUUID();
  await tx.execute(sql`insert into ${platformEventOutbox} (
    "id", "event_type", "aggregate_type", "aggregate_id", "payload", "occurred_at", "available_at"
  ) values (
    ${sql.param(id, platformEventOutbox.id)},
    ${sql.param(input.eventType, platformEventOutbox.eventType)},
    ${sql.param(input.aggregateType, platformEventOutbox.aggregateType)},
    ${sql.param(input.aggregateId, platformEventOutbox.aggregateId)},
    ${sql.param(input.payload, platformEventOutbox.payload)},
    ${sql.param(input.occurredAt, platformEventOutbox.occurredAt)},
    ${sql.param(input.availableAt ?? input.occurredAt, platformEventOutbox.availableAt)}
  )`);
  return id;
}

export async function registerEventConsumption(
  tx: DatabaseTransaction,
  input: { consumerName: string; eventId: string },
): Promise<boolean> {
  const result = await tx.execute(sql`insert into ${platformEventConsumptions} (
    "consumer_name", "event_id"
  ) values (
    ${sql.param(input.consumerName, platformEventConsumptions.consumerName)},
    ${sql.param(input.eventId, platformEventConsumptions.eventId)}
  ) on conflict do nothing returning "event_id"`);
  return result.rowCount === 1;
}
