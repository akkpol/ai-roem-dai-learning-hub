import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

let appClient: Client;
let migrationClient: Client;
const accountIds: string[] = [];

beforeAll(async () => {
  appClient = new Client({ connectionString: process.env.DATABASE_URL });
  migrationClient = new Client({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  await appClient.connect();
  await migrationClient.connect();
});

afterAll(async () => {
  if (accountIds.length > 0) {
    await migrationClient.query(
      "delete from identity_audit_events where account_id = any($1::uuid[])",
      [accountIds],
    );
    await migrationClient.query(
      "delete from identity_global_role_grants where account_id = any($1::uuid[])",
      [accountIds],
    );
    await migrationClient.query(
      "delete from identity_accounts where id = any($1::uuid[])",
      [accountIds],
    );
  }
  await migrationClient.end();
  await appClient.end();
});

async function seedAccount() {
  const id = randomUUID();
  accountIds.push(id);
  await migrationClient.query(
    "insert into identity_accounts " +
      "(id,name,email,email_verified,status,age_attested_at,two_factor_enabled) " +
      "values ($1,$2,$3,true,'active',now(),true)",
    [id, "Privilege test", `${id}@example.test`],
  );
  return id;
}

it("allows the app only the role-grant lifecycle columns it needs", async () => {
  const actorId = await seedAccount();
  const targetId = await seedAccount();
  const inserted = await appClient.query<{ id: string }>(
    "insert into identity_global_role_grants " +
      "(account_id,role,granted_by_account_id,reason_code,starts_at,granted_at) " +
      "values ($1,'support_operator',$2,'support_rotation',now(),now()) returning id",
    [targetId, actorId],
  );
  const grantId = inserted.rows[0].id;

  await expect(
    appClient.query(
      "update identity_global_role_grants set role = 'platform_admin' where id = $1",
      [grantId],
    ),
  ).rejects.toThrow();
  await expect(
    appClient.query(
      "delete from identity_global_role_grants where id = $1",
      [grantId],
    ),
  ).rejects.toThrow();
  await expect(
    appClient.query(
      "update identity_global_role_grants " +
        "set revoked_by_account_id = $1, revoked_at = now() where id = $2",
      [actorId, grantId],
    ),
  ).resolves.toMatchObject({ rowCount: 1 });
});

it("keeps audit append-only while accepting attributed redacted events", async () => {
  const actorId = await seedAccount();
  const targetId = await seedAccount();
  const inserted = await appClient.query<{ id: string }>(
    "insert into identity_audit_events " +
      "(account_id,actor_type,actor_account_id,action,reason_code,payload,occurred_at) " +
      "values ($1,'account',$2,'identity.test.v1','security_review',$3::jsonb,now()) " +
      "returning id",
    [targetId, actorId, JSON.stringify({ safe: "metadata" })],
  );
  const auditId = inserted.rows[0].id;
  await expect(
    appClient.query(
      "update identity_audit_events set reason_code = 'forged' where id = $1",
      [auditId],
    ),
  ).rejects.toThrow();
  await expect(
    appClient.query("delete from identity_audit_events where id = $1", [
      auditId,
    ]),
  ).rejects.toThrow();
});
