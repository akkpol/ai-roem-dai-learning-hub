import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";
import { Client } from "pg";

import { preflightSession002DatabaseTarget } from "../database/provider-preflight";
import { createIdentityService } from "../../src/modules/identity/service";
import { readIdentityConfig } from "../../src/modules/identity/config";
import { decryptAuthEmailIntent } from "../../src/modules/identity/email/crypto";
import { identityAccounts } from "../../src/modules/identity/schema";
import { createDatabaseConnection } from "../../src/platform/database/client";
import { readDatabaseConfig } from "../../src/platform/database/config";

type Manifest = {
  version: 1;
  providerDatabase: string;
  accountId: string;
  email: string;
  organizationIds: string[];
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`e2e fixture configuration is invalid: ${name}`);
  return value;
}

function manifestPath() {
  const value = resolve(required("E2E_FIXTURE_MANIFEST_PATH"));
  const temp = process.env.RUNNER_TEMP ? resolve(process.env.RUNNER_TEMP) : undefined;
  if ((temp && !value.startsWith(`${temp}\\`) && !value.startsWith(`${temp}/`)) || !value.endsWith(".json")) {
    throw new Error("e2e fixture manifest path is invalid");
  }
  return value;
}

function writeManifest(path: string, manifest: Manifest) {
  writeFileSync(path, `${JSON.stringify(manifest)}\n`, { encoding: "utf8", mode: 0o600 });
}

function readManifest(path: string): Manifest {
  const value = JSON.parse(readFileSync(path, "utf8")) as Partial<Manifest>;
  if (value.version !== 1 || !value.accountId || !value.email || !Array.isArray(value.organizationIds) || !value.providerDatabase) {
    throw new Error("e2e fixture manifest is invalid");
  }
  return value as Manifest;
}

function toStorageState(headers: Headers, baseUrl: string) {
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") ?? ""];
  const [hostname] = [new URL(baseUrl).hostname];
  const parsed = cookies.filter(Boolean).map((raw) => {
    const [pair, ...attributes] = raw.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (separator < 1) throw new Error("e2e fixture session cookie is invalid");
    const maxAge = attributes.find((attribute) => attribute.toLowerCase().startsWith("max-age="));
    return {
      name: pair.slice(0, separator), value: pair.slice(separator + 1), domain: hostname, path: "/",
      expires: maxAge ? Math.floor(Date.now() / 1000) + Number(maxAge.slice(8)) : -1,
      httpOnly: attributes.some((attribute) => attribute.toLowerCase() === "httponly"),
      secure: attributes.some((attribute) => attribute.toLowerCase() === "secure"),
      sameSite: "Lax" as const,
    };
  });
  if (parsed.length === 0) throw new Error("e2e fixture session cookie is missing");
  return { cookies: parsed, origins: [] };
}

async function prepare() {
  const ack = required("ORGANIZATION_E2E_FIXTURE_ACK");
  const target = await preflightSession002DatabaseTarget(process.env);
  if (target.kind !== "session-002-neon" || !target.providerIdentity || ack !== target.providerIdentity.database) {
    throw new Error("e2e fixture target acknowledgement is invalid");
  }
  const path = manifestPath();
  if (existsSync(path)) throw new Error("e2e fixture manifest already exists");
  const storagePath = resolve(required("IDENTITY_E2E_ADMIN_STORAGE_STATE"));
  const config = readIdentityConfig(process.env);
  const connection = createDatabaseConnection(readDatabaseConfig(process.env));
  const migration = new Client({ connectionString: required("MIGRATION_DATABASE_URL") });
  const nonce = randomBytes(12).toString("hex");
  const email = `org-e2e-${nonce}@example.test`;
  const password = `E2E-${randomBytes(24).toString("base64url")}!`;
  try {
    await migration.connect();
    const service = createIdentityService(connection.db, config);
    await service.signUp({ displayName: "Organization E2E Owner", email, password, callbackPath: "/organizations", termsVersion: config.termsVersion, privacyVersion: config.privacyVersion, acceptedAt: new Date() });
    const account = await connection.db.select({ id: identityAccounts.id }).from(identityAccounts).where(eq(identityAccounts.email, email));
    const accountId = account[0]?.id;
    if (!accountId) throw new Error("e2e fixture account was not created");
    // Persist cleanup authority immediately after the first external write.
    writeManifest(path, { version: 1, providerDatabase: target.providerIdentity.database, accountId, email, organizationIds: [] });
    const outbox = await migration.query<{ encrypted_payload: string }>(
      "select encrypted_payload from identity_email_outbox where account_id = $1 and template = 'verify_email' order by created_at desc limit 1", [accountId],
    );
    const encrypted = outbox.rows[0]?.encrypted_payload;
    if (!encrypted) throw new Error("e2e fixture verification intent is missing");
    const intent = decryptAuthEmailIntent(encrypted, config.emailEncryptionKey);
    await service.verifyEmail(intent.token);
    const signedIn = await service.signIn({ email, password, callbackPath: "/organizations" }, new Headers({ origin: new URL(config.baseUrl).origin }));
    if (signedIn.status !== 200) throw new Error("e2e fixture sign-in failed");
    writeFileSync(storagePath, `${JSON.stringify(toStorageState(signedIn.headers, config.baseUrl))}\n`, { encoding: "utf8", mode: 0o600 });
    console.info("organization.e2e_fixture.prepared", { accountId });
  } finally {
    await connection.close();
    await migration.end();
  }
}

async function cleanup() {
  const path = manifestPath();
  if (!existsSync(path)) return;
  const manifest = readManifest(path);
  const target = await preflightSession002DatabaseTarget(process.env);
  if (target.kind !== "session-002-neon" || target.providerIdentity?.database !== manifest.providerDatabase || required("ORGANIZATION_E2E_FIXTURE_ACK") !== manifest.providerDatabase) {
    throw new Error("e2e fixture cleanup target is invalid");
  }
  const migration = new Client({ connectionString: required("MIGRATION_DATABASE_URL") });
  try {
    await migration.connect();
    await migration.query("begin");
    const known = await migration.query<{ organization_id: string }>("select organization_id from organization_memberships where account_id = $1", [manifest.accountId]);
    const organizationIds = [...new Set([...manifest.organizationIds, ...known.rows.map((row) => row.organization_id)])];
    await migration.query("delete from organization_audit_events where organization_id = any($1::uuid[])", [organizationIds]);
    await migration.query("delete from organization_memberships where organization_id = any($1::uuid[])", [organizationIds]);
    await migration.query("delete from platform_event_outbox where aggregate_type = 'organization' and aggregate_id = any($1::uuid[])", [organizationIds]);
    await migration.query("delete from organizations where id = any($1::uuid[])", [organizationIds]);
    await migration.query("delete from identity_audit_events where account_id = $1 or actor_account_id = $1", [manifest.accountId]);
    await migration.query("delete from identity_account_deletion_requests where account_id = $1", [manifest.accountId]);
    await migration.query("delete from identity_email_outbox where account_id = $1", [manifest.accountId]);
    await migration.query("delete from identity_policy_acceptances where account_id = $1", [manifest.accountId]);
    await migration.query("delete from identity_profiles where account_id = $1", [manifest.accountId]);
    await migration.query("delete from identity_sessions where user_id = $1", [manifest.accountId]);
    await migration.query("delete from identity_auth_factors where user_id = $1", [manifest.accountId]);
    await migration.query("delete from identity_accounts where id = $1", [manifest.accountId]);
    await migration.query("commit");
  } catch (error) { await migration.query("rollback").catch(() => undefined); throw error; } finally { await migration.end(); rmSync(path, { force: true }); }
}

if (process.argv[2] === "prepare") await prepare();
else if (process.argv[2] === "cleanup") await cleanup();
else throw new Error("usage: organization-provider-fixture <prepare|cleanup>");

export { toStorageState };
