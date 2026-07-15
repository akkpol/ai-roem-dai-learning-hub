import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertPostgresUrlTls,
  isLoopbackPostgresUrl,
} from "../../src/platform/database/config";

const approvedProjectId = "raspy-feather-85795196";
const forbiddenDefaultBranchId = "br-solitary-cell-aorxyd0b";
const forbiddenBranchNames = new Set(["default", "main", "prod", "production"]);

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

export function preflightSession002DatabaseTarget(
  input: Environment,
): ValidatedDatabaseTarget {
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

  return validateApprovedRemoteTarget(applicationUrl, migrationUrl, input);
}

export function assertSafeIntegrationReset(
  url: string,
  input: Environment,
): ValidatedDatabaseTarget {
  try {
    const target = preflightSession002DatabaseTarget(input);
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

function validateApprovedRemoteTarget(
  applicationUrl: string,
  migrationUrl: string,
  input: Environment,
): ValidatedDatabaseTarget {
  const application = new URL(applicationUrl);
  const migration = new URL(migrationUrl);
  const requested = readRequestedIdentity(input);
  const accepted = readAcceptedIdentity(input);
  const endpointSuffix = accepted.endpointHostname.slice(
    accepted.endpointId.length,
  );
  const pooledHostname = `${accepted.endpointId}-pooler${endpointSuffix}`;

  if (
    requested.projectId !== approvedProjectId ||
    requested.branchId !== accepted.branchId ||
    requested.branchName !== accepted.branchName ||
    requested.endpointId !== accepted.endpointId ||
    requested.endpointHostname !== accepted.endpointHostname ||
    requested.database !== accepted.database ||
    accepted.branchId === forbiddenDefaultBranchId ||
    forbiddenBranchNames.has(accepted.branchName.toLowerCase()) ||
    input.NEON_BRANCH_IS_DEFAULT !== "false" ||
    !accepted.endpointHostname.endsWith(".neon.tech") ||
    accepted.endpointHostname.split(".")[0] !== accepted.endpointId ||
    migration.hostname !== accepted.endpointHostname ||
    ![accepted.endpointHostname, pooledHostname].includes(application.hostname) ||
    !hasApprovedPort(application) ||
    !hasApprovedPort(migration) ||
    databaseName(application) !== accepted.database ||
    databaseName(migration) !== accepted.database ||
    !accepted.database.endsWith("_test")
  ) {
    throw new Error("Database provider preflight rejected");
  }

  const providerIdentity = Object.freeze({
    projectId: approvedProjectId,
    branchId: accepted.branchId,
    branchName: accepted.branchName,
    endpointId: accepted.endpointId,
    endpointHostname: accepted.endpointHostname,
    database: accepted.database,
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

function readAcceptedIdentity(input: Environment): ApprovedProviderIdentity {
  return Object.freeze({
    projectId: approvedProjectId,
    branchId: requiredIdentityValue(input.SESSION_002_APPROVED_NEON_BRANCH_ID),
    branchName: requiredIdentityValue(
      input.SESSION_002_APPROVED_NEON_BRANCH_NAME,
    ),
    endpointId: requiredIdentityValue(
      input.SESSION_002_APPROVED_NEON_ENDPOINT_ID,
    ),
    endpointHostname: requiredIdentityValue(
      input.SESSION_002_APPROVED_NEON_ENDPOINT_HOSTNAME,
    ),
    database: requiredIdentityValue(
      input.SESSION_002_APPROVED_NEON_DATABASE_NAME,
    ),
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
    preflightSession002DatabaseTarget(process.env);
    console.info("database.provider_preflight.completed");
  } catch (error) {
    console.error("database.provider_preflight.failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    process.exitCode = 1;
  }
}
