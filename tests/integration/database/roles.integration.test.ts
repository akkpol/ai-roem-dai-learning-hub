import crypto from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

let appClient: Client;
let migrationClient: Client;

beforeAll(async () => {
  appClient = new Client({ connectionString: process.env.DATABASE_URL });
  migrationClient = new Client({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  await appClient.connect();
  await migrationClient.connect();
});

afterAll(async () => {
  await migrationClient.query("drop table if exists future_privilege_probe");
  await migrationClient.end();
  await appClient.end();
});

it("permits only the event writes used by current callers", async () => {
  const eventId = crypto.randomUUID();
  await appClient.query(
    "insert into platform_event_outbox " +
      "(id,event_type,aggregate_type,aggregate_id,payload,occurred_at,available_at) " +
      "values ($1,$2,$3,$4,$5::jsonb,now(),now())",
    [eventId, "platform.test.v1", "test", crypto.randomUUID(), "{}"],
  );

  const consumption = await appClient.query<{ event_id: string }>(
    "insert into platform_event_consumptions (consumer_name,event_id) " +
      "values ($1,$2) on conflict do nothing returning event_id",
    ["privilege-test", eventId],
  );
  expect(consumption.rows).toEqual([{ event_id: eventId }]);
});

it("denies INSERT into protected lifecycle and audit columns", async () => {
  const outboxAttempts = [
    ["state", "'published'"],
    ["attempt_count", "1"],
    ["claimed_at", "now()"],
    ["published_at", "now()"],
    ["last_error_code", "'forged'"],
    ["created_at", "now()"],
  ];
  for (const [column, value] of outboxAttempts) {
    await expect(
      appClient.query(
        "insert into platform_event_outbox " +
          "(id,event_type,aggregate_type,aggregate_id,payload,occurred_at,available_at," +
          `${column}) values ($1,$2,$3,$4,$5::jsonb,now(),now(),${value})`,
        [
          crypto.randomUUID(),
          "platform.test.protected-insert.v1",
          "test",
          crypto.randomUUID(),
          "{}",
        ],
      ),
    ).rejects.toThrow();
  }
  await expect(
    appClient.query(
      "insert into platform_event_consumptions " +
        "(consumer_name,event_id,consumed_at) values ($1,$2,now())",
      ["forged-consumption", crypto.randomUUID()],
    ),
  ).rejects.toThrow();
});

it("exposes only the required INSERT columns and no outbox SELECT", async () => {
  const privileges = await migrationClient.query<{
    columnName: string;
    canInsert: boolean;
    tableName: string;
  }>(
    "select table_name as \"tableName\", column_name as \"columnName\", " +
      "has_column_privilege('learning_hub_app', " +
      "table_name, column_name, 'insert') as \"canInsert\" " +
      "from information_schema.columns " +
      "where table_schema = 'public' and table_name in " +
      "('platform_event_outbox','platform_event_consumptions') " +
      "order by table_name, ordinal_position",
  );
  const allowed = new Set([
    "platform_event_consumptions.consumer_name",
    "platform_event_consumptions.event_id",
    "platform_event_outbox.id",
    "platform_event_outbox.event_type",
    "platform_event_outbox.aggregate_type",
    "platform_event_outbox.aggregate_id",
    "platform_event_outbox.payload",
    "platform_event_outbox.occurred_at",
    "platform_event_outbox.available_at",
  ]);
  expect(privileges.rows).toEqual(
    privileges.rows.map((row) => ({
      ...row,
      canInsert: allowed.has(`${row.tableName}.${row.columnName}`),
    })),
  );
  await expect(appClient.query("select id from platform_event_outbox limit 1"))
    .rejects.toThrow();
});

it("denies destructive event changes, schema creation, and migration metadata", async () => {
  await expect(
    appClient.query("update platform_event_outbox set state = 'published' where false"),
  ).rejects.toThrow();
  await expect(appClient.query("delete from platform_event_outbox where false"))
    .rejects.toThrow();
  await expect(
    appClient.query(
      "update platform_event_consumptions set consumed_at = now() where false",
    ),
  ).rejects.toThrow();
  await expect(
    appClient.query("delete from platform_event_consumptions where false"),
  ).rejects.toThrow();
  await expect(appClient.query("create table forbidden_by_app_role(id integer)"))
    .rejects.toThrow();
  await expect(appClient.query('select * from drizzle."__drizzle_migrations"'))
    .rejects.toThrow();
});

it("grants no application privilege on tables created by future migrations", async () => {
  await migrationClient.query("drop table if exists future_privilege_probe");
  await migrationClient.query("create table future_privilege_probe(id integer)");

  const privileges = await appClient.query<{
    canDelete: boolean;
    canInsert: boolean;
    canSelect: boolean;
    canUpdate: boolean;
  }>(
    "select " +
      "has_table_privilege(current_user, 'future_privilege_probe', 'select') as \"canSelect\"," +
      "has_table_privilege(current_user, 'future_privilege_probe', 'insert') as \"canInsert\"," +
      "has_table_privilege(current_user, 'future_privilege_probe', 'update') as \"canUpdate\"," +
      "has_table_privilege(current_user, 'future_privilege_probe', 'delete') as \"canDelete\"",
  );

  expect(privileges.rows).toEqual([{
    canDelete: false,
    canInsert: false,
    canSelect: false,
    canUpdate: false,
  }]);
});
