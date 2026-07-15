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
      "(id,event_type,aggregate_type,aggregate_id,payload,occurred_at) " +
      "values ($1,$2,$3,$4,$5::jsonb,now())",
    [eventId, "platform.test.v1", "test", crypto.randomUUID(), "{}"],
  );

  const consumption = await appClient.query<{ event_id: string }>(
    "insert into platform_event_consumptions (consumer_name,event_id) " +
      "values ($1,$2) on conflict do nothing returning event_id",
    ["privilege-test", eventId],
  );
  expect(consumption.rows).toEqual([{ event_id: eventId }]);
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
