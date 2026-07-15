import type { DatabaseTransaction } from "@/platform/database/transaction";

import type { DomainEventInput } from "./domain-event";
import { platformEventConsumptions, platformEventOutbox } from "./schema";

export async function enqueueDomainEvent(
  tx: DatabaseTransaction,
  input: DomainEventInput,
): Promise<string> {
  const id = crypto.randomUUID();
  await tx.insert(platformEventOutbox).values({
    id,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    occurredAt: input.occurredAt,
    availableAt: input.availableAt ?? input.occurredAt,
  });
  return id;
}

export async function registerEventConsumption(
  tx: DatabaseTransaction,
  input: { consumerName: string; eventId: string },
): Promise<boolean> {
  const rows = await tx
    .insert(platformEventConsumptions)
    .values(input)
    .onConflictDoNothing()
    .returning({ eventId: platformEventConsumptions.eventId });
  return rows.length === 1;
}
