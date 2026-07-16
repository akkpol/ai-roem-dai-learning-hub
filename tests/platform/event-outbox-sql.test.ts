import type { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import type { DatabaseTransaction } from "@/platform/database/transaction";
import {
  enqueueDomainEvent,
  registerEventConsumption,
} from "@/platform/events";
import {
  platformEventConsumptions,
  platformEventOutbox,
} from "@/platform/events/schema";

type CapturedQuery = {
  text: string;
  params: readonly unknown[];
};

class QueryRecorder {
  readonly queries: CapturedQuery[] = [];

  constructor(private readonly insertsReturningRow = false) {}

  async query(
    config: { text: string; rowMode?: string },
    params: readonly unknown[] = [],
  ) {
    this.queries.push({ text: config.text, params });

    const rows = this.insertsReturningRow
      ? config.rowMode === "array"
        ? [[params[1]]]
        : [{ event_id: params[1] }]
      : [];

    return {
      command: "INSERT",
      rowCount: rows.length,
      oid: 0,
      fields: [],
      rows,
    };
  }
}

function createTransaction(insertsReturningRow = false) {
  const recorder = new QueryRecorder(insertsReturningRow);
  const database = drizzle({
    client: recorder as unknown as Pool,
    schema: { platformEventConsumptions, platformEventOutbox },
  });

  return {
    recorder,
    transaction: database as unknown as DatabaseTransaction,
  };
}

function insertColumns(query: string, table: string): string[] {
  const match = query.match(new RegExp(`^insert into "${table}" \\(([^)]+)\\)`));
  expect(match, query).not.toBeNull();
  return match![1].split(",").map((column) => column.trim().replaceAll('"', ""));
}

function normalizedSql(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

describe("event outbox SQL", () => {
  it("enqueues with only the runtime-granted outbox columns and bound typed values", async () => {
    const { recorder, transaction } = createTransaction();
    const occurredAt = new Date("2026-07-16T01:02:03.000Z");
    const availableAt = new Date("2026-07-16T01:03:04.000Z");
    const aggregateId = "8f419176-f5cd-4c4d-a1c7-f4a383c915c9";
    const payload = { source: "unit-test", nested: { count: 2 } };

    const eventId = await enqueueDomainEvent(transaction, {
      eventType: "platform.test.v1",
      aggregateType: "test_aggregate",
      aggregateId,
      payload,
      occurredAt,
      availableAt,
    });

    expect(recorder.queries).toHaveLength(1);
    const [query] = recorder.queries;
    expect(insertColumns(query.text, "platform_event_outbox")).toEqual([
      "id",
      "event_type",
      "aggregate_type",
      "aggregate_id",
      "payload",
      "occurred_at",
      "available_at",
    ]);
    expect(normalizedSql(query.text)).toMatch(
      /values \( \$1, \$2, \$3, \$4, \$5, \$6, \$7 \)$/,
    );
    expect(query.params).toEqual([
      eventId,
      "platform.test.v1",
      "test_aggregate",
      aggregateId,
      JSON.stringify(payload),
      occurredAt.toISOString(),
      availableAt.toISOString(),
    ]);
  });

  it.each([
    { inserted: true, expected: true },
    { inserted: false, expected: false },
  ])(
    "registers consumption with only granted columns and returns $expected when inserted=$inserted",
    async ({ inserted, expected }) => {
      const { recorder, transaction } = createTransaction(inserted);
      const input = {
        consumerName: "email-projector",
        eventId: "da87dcc5-8276-456f-bb05-e3e56494207b",
      };

      await expect(registerEventConsumption(transaction, input)).resolves.toBe(expected);

      expect(recorder.queries).toHaveLength(1);
      const [query] = recorder.queries;
      expect(insertColumns(query.text, "platform_event_consumptions")).toEqual([
        "consumer_name",
        "event_id",
      ]);
      expect(normalizedSql(query.text)).toMatch(
        /values \( \$1, \$2 \) on conflict do nothing returning "event_id"$/,
      );
      expect(query.params).toEqual([input.consumerName, input.eventId]);
    },
  );
});
