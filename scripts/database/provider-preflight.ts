import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertPostgresUrlTls,
  isLoopbackPostgresUrl,
} from "../../src/platform/database/config";

const approvedProjectId = "raspy-feather-85795196";
const forbiddenDefaultBranchId = "br-solitary-cell-aorxyd0b";
const neonApiBaseUrl = "https://console.neon.tech/api/v2";
const disposableBranchName =
  /^session-002-acceptance-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const forbiddenBranchNameToken =
  /(production|prod|main|master|default|staging|stage)/;

type Environment = Record<string, string | undefined>;

type ApprovedProviderIdentity = Readonly<{
  projectId: string;
  branchId: string;
  branchName: string;
  endpointId: string;
  endpointHostname: string;
  database: string;
}>;

export type ValidatedDatabaseTarget = Readonly<{
  applicationUrl: string;
  migrationUrl: string;
  kind: "local" | "session-002-neon";
  providerIdentity?: ApprovedProviderIdentity;
}>;

export async function preflightSession002DatabaseTarget(
  input: Environment,
  providerFetch: typeof fetch = fetch,
): Promise<ValidatedDatabaseTarget> {
  const applicationUrl = readPostgresUrl(input.DATABASE_URL, "DATABASE_URL");
  const migrationUrl = readPostgresUrl(
    input.MIGRATION_DATABASE_URL,
    "MIGRATION_DATABASE_URL",
  );

  if (applicationUrl === migrationUrl) {
    throw new Error("MIGRATION_DATABASE_URL must be separate from DATABASE_URL");
  }
  if (
    postgresLoginPrincipal(applicationUrl) ===
    postgresLoginPrincipal(migrationUrl)
  ) {
    throw new Error(
      "MIGRATION_DATABASE_URL and DATABASE_URL must use different PostgreSQL login principals",
    );
  }

  const applicationIsLocal = isLoopbackPostgresUrl(applicationUrl);
  const migrationIsLocal = isLoopbackPostgresUrl(migrationUrl);
  if (applicationIsLocal || migrationIsLocal) {
    if (!applicationIsLocal || !migrationIsLocal) {
      throw new Error("Database provider preflight rejected");
    }
    return Object.freeze({ applicationUrl, migrationUrl, kind: "local" });
  }

  try {
    return await validateApprovedRemoteTarget(
      applicationUrl,
      migrationUrl,
      input,
      providerFetch,
    );
  } catch {
    throw new Error("Database provider preflight rejected");
  }
}

export async function assertSafeIntegrationReset(
  url: string,
  input: Environment,
  providerFetch: typeof fetch = fetch,
): Promise<ValidatedDatabaseTarget> {
  try {
    const target = await preflightSession002DatabaseTarget(input, providerFetch);
    const identity = target.providerIdentity;
    if (
      target.kind !== "session-002-neon" ||
      !identity ||
      url !== target.migrationUrl ||
      input.REMOTE_TEST_DATABASE_RESET_ACK !== identity.database ||
      input.REMOTE_TEST_NEON_IDENTITY_ACK !== identityAcknowledgement(identity)
    ) {
      throw new Error();
    }
    return target;
  } catch {
    throw new Error("Refusing destructive integration reset");
  }
}

async function validateApprovedRemoteTarget(
  applicationUrl: string,
  migrationUrl: string,
  input: Environment,
  providerFetch: typeof fetch,
): Promise<ValidatedDatabaseTarget> {
  const application = new URL(applicationUrl);
  const migration = new URL(migrationUrl);
  const requested = readRequestedIdentity(input);

  if (
    requested.projectId !== approvedProjectId ||
    !hasApprovedPort(application) ||
    !hasApprovedPort(migration) ||
    !requested.database.endsWith("_test")
  ) {
    throw new Error("Database provider preflight rejected");
  }

  const apiKey = requiredApiKey(input.NEON_API_KEY);
  const branchPath =
    `/projects/${approvedProjectId}/branches/` +
    encodeURIComponent(requested.branchId);
  const branchResponse = await readProviderJson(
    providerFetch,
    branchPath,
    apiKey,
  );
  const branch = providerRecord(providerRecord(branchResponse).branch);
  const branchId = providerString(branch.id);
  const branchProjectId = providerString(branch.project_id);
  const branchName = providerString(branch.name);
  const branchIsDefault = providerBoolean(branch.default);
  const branchIsProtected = providerBoolean(branch.protected);

  if (
    branchId !== requested.branchId ||
    branchProjectId !== approvedProjectId ||
    branchName !== requested.branchName ||
    branchIsDefault ||
    branchIsProtected ||
    branchId === forbiddenDefaultBranchId ||
    !disposableBranchName.test(branchName) ||
    forbiddenBranchNameToken.test(branchName) ||
    input.NEON_BRANCH_IS_DEFAULT !== "false"
  ) {
    throw new Error("Database provider preflight rejected");
  }

  const endpointsResponse = await readProviderJson(
    providerFetch,
    `${branchPath}/endpoints`,
    apiKey,
  );
  const endpoints = providerArray(providerRecord(endpointsResponse).endpoints);
  const endpoint = endpoints
    .map(providerRecord)
    .find((candidate) => candidate.id === requested.endpointId);
  if (!endpoint) {
    throw new Error("Database provider preflight rejected");
  }
  const endpointId = providerString(endpoint.id);
  const endpointProjectId = providerString(endpoint.project_id);
  const endpointBranchId = providerString(endpoint.branch_id);
  const endpointHostname = providerString(endpoint.host);
  const endpointSuffix = endpointHostname.slice(endpointId.length);
  const pooledHostname = `${endpointId}-pooler${endpointSuffix}`;

  if (
    endpointProjectId !== approvedProjectId ||
    endpointBranchId !== branchId ||
    endpointHostname !== requested.endpointHostname ||
    !endpointHostname.endsWith(".neon.tech") ||
    endpointHostname.split(".")[0] !== endpointId ||
    migration.hostname !== endpointHostname ||
    application.hostname !== pooledHostname
  ) {
    throw new Error("Database provider preflight rejected");
  }

  const databasesResponse = await readProviderJson(
    providerFetch,
    `${branchPath}/databases`,
    apiKey,
  );
  const databases = providerArray(providerRecord(databasesResponse).databases);
  const database = databases
    .map(providerRecord)
    .find((candidate) => candidate.name === requested.database);
  if (
    !database ||
    providerString(database.branch_id) !== branchId ||
    databaseName(application) !== requested.database ||
    databaseName(migration) !== requested.database
  ) {
    throw new Error("Database provider preflight rejected");
  }

  const providerIdentity = Object.freeze({
    projectId: approvedProjectId,
    branchId,
    branchName,
    endpointId,
    endpointHostname,
    database: requested.database,
  });
  return Object.freeze({
    applicationUrl,
    migrationUrl,
    kind: "session-002-neon" as const,
    providerIdentity,
  });
}

function readRequestedIdentity(input: Environment): ApprovedProviderIdentity {
  return Object.freeze({
    projectId: requiredIdentityValue(input.NEON_PROJECT_ID),
    branchId: requiredIdentityValue(input.NEON_BRANCH_ID),
    branchName: requiredIdentityValue(input.NEON_BRANCH_NAME),
    endpointId: requiredIdentityValue(input.NEON_ENDPOINT_ID),
    endpointHostname: requiredIdentityValue(input.NEON_ENDPOINT_HOSTNAME),
    database: requiredIdentityValue(input.NEON_DATABASE_NAME),
  });
}

function readPostgresUrl(value: string | undefined, variableName: string): string {
  if (!value) {
    throw new Error(`${variableName} must be a PostgreSQL URL`);
  }
  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      throw new Error();
    }
    assertPostgresUrlTls(value, variableName);
    return value;
  } catch (error) {
    if (error instanceof Error && !error.message.includes(value)) {
      throw error;
    }
    throw new Error(`${variableName} must be a PostgreSQL URL`);
  }
}

function requiredIdentityValue(value: string | undefined): string {
  if (!value || value.includes("|")) {
    throw new Error("Database provider preflight rejected");
  }
  return value;
}

function requiredApiKey(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error("Database provider preflight rejected");
  }
  return value.trim();
}

async function readProviderJson(
  providerFetch: typeof fetch,
  path: string,
  apiKey: string,
): Promise<unknown> {
  const response = await providerFetch(`${neonApiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error("Database provider preflight rejected");
  }
  return response.json();
}

function providerRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Database provider preflight rejected");
  }
  return value as Record<string, unknown>;
}

function providerArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Database provider preflight rejected");
  }
  return value;
}

function providerString(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Database provider preflight rejected");
  }
  return value;
}

function providerBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("Database provider preflight rejected");
  }
  return value;
}

function postgresLoginPrincipal(url: string): string {
  return decodeURIComponent(new URL(url).username);
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.slice(1));
}

function hasApprovedPort(url: URL): boolean {
  return url.port === "" || url.port === "5432";
}

function identityAcknowledgement(identity: ApprovedProviderIdentity): string {
  return [
    identity.projectId,
    identity.branchId,
    identity.branchName,
    identity.endpointId,
    identity.endpointHostname,
    identity.database,
  ].join("|");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    await preflightSession002DatabaseTarget(process.env);
    console.info("database.provider_preflight.completed");
  } catch (error) {
    console.error("database.provider_preflight.failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    process.exitCode = 1;
  }
}
