import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { Actor } from "@/modules/identity";
import { createOrganizationService } from "@/modules/organizations/service";
import { createDatabaseConnection, type DatabaseConnection } from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";
import { enqueueDomainEvent } from "@/platform/events";

let appClient: Client;
let migrationClient: Client;
let connection: DatabaseConnection;
const organizationIds: string[] = [];

beforeAll(async () => {
  appClient = new Client({ connectionString: process.env.DATABASE_URL });
  migrationClient = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
  await appClient.connect();
  await migrationClient.connect();
  connection = createDatabaseConnection(readDatabaseConfig(process.env));
});

afterAll(async () => {
  if (organizationIds.length > 0) {
    await migrationClient.query(
      "delete from organization_audit_events where organization_id = any($1::uuid[])",
      [organizationIds],
    );
    await migrationClient.query(
      "delete from organization_memberships where organization_id = any($1::uuid[])",
      [organizationIds],
    );
    await migrationClient.query(
      "delete from platform_event_outbox where aggregate_type = 'organization' and aggregate_id = any($1::uuid[])",
      [organizationIds],
    );
    await migrationClient.query("delete from organizations where id = any($1::uuid[])", [organizationIds]);
  }
  await connection.close();
  await migrationClient.end();
  await appClient.end();
});

const actor = (): Actor => ({
  accountId: randomUUID(),
  accountStatus: "active",
  emailVerified: true,
  sessionId: randomUUID(),
  sessionFresh: true,
  mfaState: "verified",
  globalRoles: [],
});

async function createActiveOrganization(accountId = randomUUID()) {
  const inserted = await appClient.query<{ id: string }>(
    "insert into organizations (display_name,slug,contact_email,locale,time_zone) values ($1,$2,$3,$4,$5) returning id",
    ["Concurrent Organization", `concurrent-${randomUUID().slice(0, 8)}`, "contact@example.test", "en-US", "Asia/Bangkok"],
  );
  const organizationId = inserted.rows[0]!.id;
  organizationIds.push(organizationId);
  await appClient.query(
    "insert into organization_memberships (organization_id,account_id,role,status) values ($1,$2,'owner','active')",
    [organizationId, accountId],
  );
  return { organizationId, accountId };
}

it("rolls back organization, owner membership, audit, and outbox event together", async () => {
  const slug = `rollback-${randomUUID().slice(0, 8)}`;
  const service = createOrganizationService(connection.db, undefined, {
    enqueueEvent: async (transaction, input) => {
      await enqueueDomainEvent(transaction, input);
      throw new Error("force organization rollback");
    },
  });

  await expect(
    service.createOrganization(actor(), {
      displayName: "Rollback Organization",
      slug,
      contactEmail: "contact@example.test",
      locale: "en-US",
      timeZone: "Asia/Bangkok",
    }),
  ).rejects.toThrow("force organization rollback");

  await expect(
    migrationClient.query("select id from organizations where slug = $1", [slug]),
  ).resolves.toMatchObject({ rowCount: 0 });
  await expect(
    migrationClient.query(
      "select id from platform_event_outbox where event_type = 'organization.created.v1' and payload->>'slug' = $1",
      [slug],
    ),
  ).resolves.toMatchObject({ rowCount: 0 });
});

it("allows only the organization runtime lifecycle writes and keeps audits append-only", async () => {
  const accountId = randomUUID();
  const inserted = await appClient.query<{ id: string }>(
    "insert into organizations (display_name,slug,contact_email,locale,time_zone) values ($1,$2,$3,$4,$5) returning id",
    ["Integration Organization", `integration-${randomUUID().slice(0, 8)}`, "contact@example.test", "en-US", "Asia/Bangkok"],
  );
  const organizationId = inserted.rows[0]!.id;
  organizationIds.push(organizationId);
  await appClient.query(
    "insert into organization_memberships (organization_id,account_id,role,status) values ($1,$2,'owner','active')",
    [organizationId, accountId],
  );
  await expect(
    appClient.query(
      "select organization_id,account_id,role,status from organization_memberships where organization_id = $1 and account_id = $2",
      [organizationId, accountId],
    ),
  ).resolves.toMatchObject({
    rows: [{
      organization_id: organizationId,
      account_id: accountId,
      role: "owner",
      status: "active",
    }],
  });
  await expect(
    appClient.query("select removed_at from organization_memberships where organization_id = $1", [organizationId]),
  ).rejects.toThrow();
  await expect(
    appClient.query("select id from organization_memberships where organization_id = $1", [organizationId]),
  ).rejects.toThrow();
  await expect(
    appClient.query("update organization_audit_events set action = 'forged' where false"),
  ).rejects.toThrow();
  await expect(
    appClient.query("select id from organization_audit_events limit 1"),
  ).rejects.toThrow();
});

it("allows exactly one concurrent identity update for the same optimistic version", async () => {
  const { organizationId, accountId } = await createActiveOrganization();
  const service = createOrganizationService(connection.db);
  const currentActor: Actor = { ...actor(), accountId };
  const command = (displayName: string) => ({
    organizationId,
    displayName,
    description: null,
    contactEmail: "contact@example.test",
    locale: "en-US" as const,
    timeZone: "Asia/Bangkok",
    expectedVersion: 1,
  });

  const results = await Promise.all([
    service.updateOrganizationIdentity(currentActor, command("First Update")),
    service.updateOrganizationIdentity(currentActor, command("Second Update")),
  ]);

  expect(results.filter((result) => result.ok)).toHaveLength(1);
  expect(results.filter((result) => !result.ok && result.error.code === "stale_version")).toHaveLength(1);
  await expect(
    migrationClient.query("select version from organizations where id = $1", [organizationId]),
  ).resolves.toMatchObject({ rows: [{ version: 2 }] });
});

it("enforces unique slug and one active membership without partial writes", async () => {
  const { organizationId, accountId } = await createActiveOrganization();
  const slug = `unique-${randomUUID().slice(0, 8)}`;
  const first = await appClient.query<{ id: string }>(
    "insert into organizations (display_name,slug,contact_email,locale,time_zone) values ($1,$2,$3,$4,$5) returning id",
    ["Unique Organization", slug, "contact@example.test", "en-US", "Asia/Bangkok"],
  );
  organizationIds.push(first.rows[0]!.id);
  await expect(
    appClient.query(
      "insert into organizations (display_name,slug,contact_email,locale,time_zone) values ($1,$2,$3,$4,$5)",
      ["Duplicate Organization", slug, "contact@example.test", "en-US", "Asia/Bangkok"],
    ),
  ).rejects.toMatchObject({ code: "23505" });
  await expect(
    appClient.query("select id from organizations where slug = $1", [slug]),
  ).resolves.toMatchObject({ rowCount: 1 });

  await expect(
    appClient.query(
      "insert into organization_memberships (organization_id,account_id,role,status) values ($1,$2,'member','active')",
      [organizationId, accountId],
    ),
  ).rejects.toMatchObject({ code: "23505" });
  await expect(
    migrationClient.query(
      "select role,status from organization_memberships where organization_id = $1 and account_id = $2",
      [organizationId, accountId],
    ),
  ).resolves.toMatchObject({ rows: [{ role: "owner", status: "active" }] });
});

it("rejects an update when a future membership writer commits under the organization aggregate lock", async () => {
  const { organizationId, accountId } = await createActiveOrganization();
  const service = createOrganizationService(connection.db);
  const currentActor: Actor = { ...actor(), accountId };
  await migrationClient.query("begin");
  try {
    await migrationClient.query(
      "select id from organizations where id = $1 for update",
      [organizationId],
    );
    await migrationClient.query(
      "update organization_memberships set role = 'member' where organization_id = $1 and account_id = $2",
      [organizationId, accountId],
    );
    const pending = service.updateOrganizationIdentity(currentActor, {
      organizationId,
      displayName: "Should Not Update",
      description: null,
      contactEmail: "contact@example.test",
      locale: "en-US",
      timeZone: "Asia/Bangkok",
      expectedVersion: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await migrationClient.query("commit");
    await expect(pending).resolves.toEqual({ ok: false, error: { code: "forbidden" } });
  } catch (error) {
    await migrationClient.query("rollback");
    throw error;
  }
  await expect(
    migrationClient.query("select version from organizations where id = $1", [organizationId]),
  ).resolves.toMatchObject({ rows: [{ version: 1 }] });
});
