import crypto from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

it("permits event writes but not schema or migration history access for the app role", async () => {
  await client.query(
    "insert into platform_event_outbox " +
      "(id,event_type,aggregate_type,aggregate_id,payload,occurred_at) " +
      "values ($1,$2,$3,$4,$5::jsonb,now())",
    [crypto.randomUUID(), "platform.test.v1", "test", crypto.randomUUID(), "{}"],
  );
  await expect(client.query("create table forbidden_by_app_role(id integer)")).rejects.toThrow();
  await expect(client.query('select * from drizzle."__drizzle_migrations"')).rejects.toThrow();
});
