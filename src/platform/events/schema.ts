import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { JsonObject } from "./domain-event";

export const platformEventOutbox = pgTable("platform_event_outbox", {
  id: uuid("id").primaryKey(),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").$type<JsonObject>().notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  state: text("state").notNull().default("pending"),
  availableAt: timestamp("available_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  attemptCount: integer("attempt_count").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("platform_event_outbox_dispatch_idx").on(table.state, table.availableAt),
  index("platform_event_outbox_aggregate_idx").on(
    table.aggregateType,
    table.aggregateId,
    table.occurredAt,
  ),
  check(
    "platform_event_outbox_state_check",
    sql`${table.state} in ('pending','publishing','retry_wait','published','dead_letter')`,
  ),
  check("platform_event_outbox_attempt_count_check", sql`${table.attemptCount} >= 0`),
]);

export const platformEventConsumptions = pgTable("platform_event_consumptions", {
  consumerName: text("consumer_name").notNull(),
  eventId: uuid("event_id").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (table) => [primaryKey({
  name: "platform_event_consumptions_pk",
  columns: [table.consumerName, table.eventId],
})]);
