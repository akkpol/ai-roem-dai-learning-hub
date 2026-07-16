import crypto from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";
import { withTransaction } from "@/platform/database/transaction";
import {
  enqueueDomainEvent,
  registerEventConsumption,
} from "@/platform/events";
let connection: DatabaseConnection;
let observerClient: Client;

beforeAll(() => {
  connection = createDatabaseConnection(readDatabaseConfig(process.env));
  observerClient = new Client({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  return observerClient.connect();
});

afterAll(async () => {
  await connection.close();
  await observerClient.end();
});

it("rolls back an enqueued event when its transaction fails", async () => {
  const aggregateId = crypto.randomUUID();
  const occurredAt = new Date("2026-07-15T00:00:00.000Z");

  await expect(
    withTransaction(connection.db, async (transaction) => {
      await enqueueDomainEvent(transaction, {
        eventType: "platform.test.v1",
        aggregateType: "test_aggregate",
        aggregateId,
        payload: { source: "outbox.integration.test" },
        occurredAt,
      });
      throw new Error("force rollback");
    }),
  ).rejects.toThrow("force rollback");

  const rows = await observerClient.query(
    "select id from platform_event_outbox where aggregate_id = $1",
    [aggregateId],
  );

  expect(rows.rows).toHaveLength(0);
});

it("records a consumer only once for the same event", async () => {
  const eventId = await withTransaction(connection.db, (transaction) =>
    enqueueDomainEvent(transaction, {
      eventType: "platform.test.v1",
      aggregateType: "test_aggregate",
      aggregateId: crypto.randomUUID(),
      payload: { source: "outbox.integration.test" },
      occurredAt: new Date("2026-07-15T00:00:00.000Z"),
    }),
  );
  const input = { consumerName: "outbox-integration-test", eventId };

  await expect(
    withTransaction(connection.db, (transaction) =>
      registerEventConsumption(transaction, input),
    ),
  ).resolves.toBe(true);
  await expect(
    withTransaction(connection.db, (transaction) =>
      registerEventConsumption(transaction, input),
    ),
  ).resolves.toBe(false);
});
