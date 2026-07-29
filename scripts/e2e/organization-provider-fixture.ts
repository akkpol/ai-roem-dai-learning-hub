import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";
import { Client } from "pg";

import { preflightSession002DatabaseTarget } from "../database/provider-preflight";
import { readIdentityConfig } from "../../src/modules/identity/config";
import { decryptAuthEmailIntent } from "../../src/modules/identity/email/crypto";
import { identityAccounts } from "../../src/modules/identity/schema";
import { createIdentityService } from "../../src/modules/identity/service";
import { createDatabaseConnection } from "../../src/platform/database/client";
import { readDatabaseConfig } from "../../src/platform/database/config";

type ProviderIdentity = { projectId: string; branchId: string; branchName: string; endpointId: string; endpointHostname: string; database: string };
type PlannedOrganization = { slug: string; id: string | null };
type Manifest = { version: 2; providerIdentity: ProviderIdentity; email: string; accountId: string | null; organizations: PlannedOrganization[] };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const fixtureEmail = /^org-e2e-[0-9a-f]{24}@example\.test$/;

export function resolveFixtureAccountId(email: string, rows: Array<{ id: string }>): string | null {
  if (!fixtureEmail.test(email)) throw new Error("e2e fixture manifest is invalid");
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0]?.id || !uuid.test(rows[0].id)) {
    throw new Error("e2e fixture account discovery is ambiguous");
  }
  return rows[0].id;
}

function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`e2e fixture configuration is invalid: ${name}`); return value; }
function path() {
  const value = resolve(required("E2E_FIXTURE_MANIFEST_PATH"));
  const temp = process.env.RUNNER_TEMP ? resolve(process.env.RUNNER_TEMP) : undefined;
  if ((temp && !value.startsWith(`${temp}\\`) && !value.startsWith(`${temp}/`)) || !value.endsWith(".json")) throw new Error("e2e fixture manifest path is invalid");
  return value;
}
function atomicWrite(manifestPath: string, manifest: Manifest) {
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(manifest)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, manifestPath);
}
function readManifest(manifestPath: string): Manifest {
  const value = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<Manifest>;
  if (value.version !== 2 || !value.providerIdentity || typeof value.email !== "string" || !fixtureEmail.test(value.email) || !Array.isArray(value.organizations) || !value.organizations.every((entry) => entry && typeof entry.slug === "string" && slug.test(entry.slug) && (entry.id === null || typeof entry.id === "string" && uuid.test(entry.id)))) throw new Error("e2e fixture manifest is invalid");
  if (value.accountId !== null && (typeof value.accountId !== "string" || !uuid.test(value.accountId))) throw new Error("e2e fixture manifest is invalid");
  return value as Manifest;
}
function identityAcknowledgement(identity: ProviderIdentity) { return [identity.projectId, identity.branchId, identity.branchName, identity.endpointId, identity.endpointHostname, identity.database].join("|"); }
async function approvedIdentity() {
  const target = await preflightSession002DatabaseTarget(process.env);
  if (target.kind !== "session-002-neon" || !target.providerIdentity || required("ORGANIZATION_E2E_FIXTURE_ACK") !== target.providerIdentity.database || required("REMOTE_TEST_NEON_IDENTITY_ACK") !== identityAcknowledgement(target.providerIdentity)) throw new Error("e2e fixture target acknowledgement is invalid");
  return target.providerIdentity;
}
function toStorageState(headers: Headers, baseUrl: string) {
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") ?? ""];
  const domain = new URL(baseUrl).hostname;
  const parsed = cookies.filter(Boolean).map((raw) => {
    const [pair, ...attributes] = raw.split(";").map((part) => part.trim()); const separator = pair.indexOf("=");
    if (separator < 1) throw new Error("e2e fixture session cookie is invalid");
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1), domain, path: "/", expires: -1, httpOnly: attributes.some((value) => value.toLowerCase() === "httponly"), secure: attributes.some((value) => value.toLowerCase() === "secure"), sameSite: "Lax" as const };
  });
  if (parsed.length === 0) throw new Error("e2e fixture session cookie is missing");
  return { cookies: parsed, origins: [] };
}
async function prepare() {
  const providerIdentity = await approvedIdentity(); const manifestPath = path();
  if (existsSync(manifestPath)) throw new Error("e2e fixture manifest already exists");
  const nonce = randomBytes(12).toString("hex");
  const manifest: Manifest = { version: 2, providerIdentity, email: `org-e2e-${nonce}@example.test`, accountId: null, organizations: [required("ORGANIZATION_E2E_DESKTOP_SLUG"), required("ORGANIZATION_E2E_MOBILE_SLUG")].map((value) => ({ slug: value, id: null })) };
  if (manifest.organizations[0]?.slug === manifest.organizations[1]?.slug) throw new Error("e2e fixture planned slugs must be distinct");
  atomicWrite(manifestPath, manifest); // pending cleanup authority exists before signUp
  const connection = createDatabaseConnection(readDatabaseConfig(process.env)); const migration = new Client({ connectionString: required("MIGRATION_DATABASE_URL") });
  const config = readIdentityConfig(process.env); const password = `E2E-${randomBytes(24).toString("base64url")}!`;
  try {
    await migration.connect(); const service = createIdentityService(connection.db, config);
    await service.signUp({ displayName: "Organization E2E Owner", email: manifest.email, password, callbackPath: "/organizations", termsVersion: config.termsVersion, privacyVersion: config.privacyVersion, acceptedAt: new Date() });
    const account = await connection.db.select({ id: identityAccounts.id }).from(identityAccounts).where(eq(identityAccounts.email, manifest.email));
    const accountId = account[0]?.id; if (!accountId || !uuid.test(accountId)) throw new Error("e2e fixture account was not created");
    manifest.accountId = accountId; atomicWrite(manifestPath, manifest);
    const outbox = await migration.query<{ encrypted_payload: string }>("select encrypted_payload from identity_email_outbox where account_id = $1 and template = 'verify_email' order by created_at desc limit 1", [accountId]);
    const encrypted = outbox.rows[0]?.encrypted_payload; if (!encrypted) throw new Error("e2e fixture verification intent is missing");
    await service.verifyEmail(decryptAuthEmailIntent(encrypted, config.emailEncryptionKey).token);
    const signedIn = await service.signIn({ email: manifest.email, password, callbackPath: "/organizations" }, new Headers({ origin: new URL(config.baseUrl).origin }));
    if (signedIn.status !== 200) throw new Error("e2e fixture sign-in failed");
    writeFileSync(resolve(required("IDENTITY_E2E_ADMIN_STORAGE_STATE")), `${JSON.stringify(toStorageState(signedIn.headers, config.baseUrl))}\n`, { encoding: "utf8", mode: 0o600 });
    console.info("organization.e2e_fixture.prepared", { accountId });
  } finally { await connection.close(); await migration.end(); }
}
async function cleanup() {
  const manifestPath = path(); if (!existsSync(manifestPath)) return;
  const manifest = readManifest(manifestPath); const providerIdentity = await approvedIdentity();
  if (identityAcknowledgement(providerIdentity) !== identityAcknowledgement(manifest.providerIdentity)) throw new Error("e2e fixture cleanup identity mismatch");
  const migration = new Client({ connectionString: required("MIGRATION_DATABASE_URL") });
  try {
    await migration.connect(); await migration.query("begin");
    if (!manifest.accountId) {
      const discoveredAccount = await migration.query<{ id: string }>(
        "select id from identity_accounts where email = $1",
        [manifest.email],
      );
      const discoveredAccountId = resolveFixtureAccountId(manifest.email, discoveredAccount.rows);
      if (discoveredAccountId) {
        manifest.accountId = discoveredAccountId;
        atomicWrite(manifestPath, manifest);
      }
    }
    if (manifest.accountId) {
      for (const organization of manifest.organizations.filter((entry) => entry.id === null)) {
        const discovered = await migration.query<{ id: string }>("select o.id from organizations o join organization_memberships m on m.organization_id = o.id join organization_audit_events a on a.organization_id = o.id where o.slug = $1 and m.account_id = $2 and a.actor_account_id = $2 and a.action = 'organization.created.v1'", [organization.slug, manifest.accountId]);
        if (discovered.rowCount === 1 && discovered.rows[0]?.id && uuid.test(discovered.rows[0].id)) { organization.id = discovered.rows[0].id; atomicWrite(manifestPath, manifest); }
        else if (discovered.rowCount !== 0) throw new Error("e2e fixture organization discovery is ambiguous");
      }
    }
    const organizationIds = manifest.organizations.map((entry) => entry.id).filter((id): id is string => Boolean(id));
    await migration.query("delete from organization_audit_events where organization_id = any($1::uuid[])", [organizationIds]);
    await migration.query("delete from organization_memberships where organization_id = any($1::uuid[])", [organizationIds]);
    await migration.query("delete from platform_event_outbox where aggregate_type = 'organization' and aggregate_id = any($1::uuid[])", [organizationIds]);
    await migration.query("delete from organizations where id = any($1::uuid[])", [organizationIds]);
    if (manifest.accountId) {
      await migration.query("delete from identity_audit_events where account_id = $1 or actor_account_id = $1", [manifest.accountId]); await migration.query("delete from identity_account_deletion_requests where account_id = $1", [manifest.accountId]); await migration.query("delete from identity_email_outbox where account_id = $1", [manifest.accountId]); await migration.query("delete from identity_policy_acceptances where account_id = $1", [manifest.accountId]); await migration.query("delete from identity_profiles where account_id = $1", [manifest.accountId]); await migration.query("delete from identity_sessions where user_id = $1", [manifest.accountId]); await migration.query("delete from identity_auth_factors where user_id = $1", [manifest.accountId]); await migration.query("delete from identity_accounts where id = $1", [manifest.accountId]);
    }
    await migration.query("commit");
    const verification = await migration.query<{ remaining: string }>(
      "select (select count(*) from identity_accounts where id = $1 or email = $2) + (select count(*) from organizations where id = any($3::uuid[])) as remaining",
      [manifest.accountId, manifest.email, organizationIds],
    );
    if (verification.rows[0]?.remaining !== "0") throw new Error("e2e fixture cleanup verification failed");
    rmSync(manifestPath); // only after committed and verified deletion
  } catch (error) { await migration.query("rollback").catch(() => undefined); throw error; } finally { await migration.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "prepare") await prepare();
  else if (process.argv[2] === "cleanup") await cleanup();
  else throw new Error("usage: organization-provider-fixture <prepare|cleanup>");
}
export { toStorageState };
