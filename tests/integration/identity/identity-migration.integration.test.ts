import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

let appClient: Client;
let migrationClient: Client;

beforeAll(async () => {
  appClient = new Client({ connectionString: process.env.DATABASE_URL });
  migrationClient = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
  await appClient.connect();
  await migrationClient.connect();
});

afterAll(async () => {
  await appClient.end();
  await migrationClient.end();
});

it("migrates the mapped Identity tables with UTC timestamps", async () => {
  const result = await migrationClient.query<{ tableName: string }>(
    "select table_name as \"tableName\" from information_schema.tables " +
      "where table_schema = 'public' and table_name like 'identity_%' order by table_name",
  );
  expect(result.rows.map((row) => row.tableName)).toEqual([
    "identity_account_deletion_requests",
    "identity_accounts",
    "identity_audit_events",
    "identity_auth_factors",
    "identity_email_outbox",
    "identity_policy_acceptances",
    "identity_profiles",
    "identity_rate_limits",
    "identity_sessions",
    "identity_two_factors",
    "identity_verifications",
  ]);
});

it("keeps audit and auth-email outbox append-only for the runtime role", async () => {
  await expect(
    appClient.query("update identity_audit_events set action = action where false"),
  ).rejects.toThrow();
  await expect(
    appClient.query("delete from identity_audit_events where false"),
  ).rejects.toThrow();
  await expect(
    appClient.query("update identity_email_outbox set state = state where false"),
  ).rejects.toThrow();
  await expect(
    appClient.query("delete from identity_email_outbox where false"),
  ).rejects.toThrow();
});

it("grants the runtime role no Identity schema creation authority", async () => {
  await expect(
    appClient.query("create table identity_forbidden_probe(id integer)"),
  ).rejects.toThrow();
});
