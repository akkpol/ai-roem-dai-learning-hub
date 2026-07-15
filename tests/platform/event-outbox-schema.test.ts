import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  platformEventConsumptions,
  platformEventOutbox,
} from "@/platform/database/schema";

describe("platform event outbox schema", () => {
  it("defines the transactional outbox table with its dispatch constraints", () => {
    const config = getTableConfig(platformEventOutbox);

    expect(config.name).toBe("platform_event_outbox");
    expect(config.columns.map((column) => column.name)).toEqual([
      "id",
      "event_type",
      "aggregate_type",
      "aggregate_id",
      "payload",
      "occurred_at",
      "state",
      "available_at",
      "attempt_count",
      "claimed_at",
      "published_at",
      "last_error_code",
      "created_at",
    ]);
    expect(config.indexes.map((index) => index.config.name)).toEqual([
      "platform_event_outbox_dispatch_idx",
      "platform_event_outbox_aggregate_idx",
    ]);
    expect(config.checks.map((check) => check.name)).toEqual([
      "platform_event_outbox_state_check",
      "platform_event_outbox_attempt_count_check",
    ]);
  });

  it("defines consumption idempotency by consumer and event", () => {
    const config = getTableConfig(platformEventConsumptions);

    expect(config.name).toBe("platform_event_consumptions");
    expect(config.primaryKeys).toHaveLength(1);
    expect(config.primaryKeys[0]).toMatchObject({
      name: "platform_event_consumptions_pk",
      columns: [
        expect.objectContaining({ name: "consumer_name" }),
        expect.objectContaining({ name: "event_id" }),
      ],
    });
  });
});
