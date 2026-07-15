import { Client } from "pg";

import { readMigrationDatabaseUrl } from "../../../scripts/database/migration-env";
import { runMigrations } from "../../../scripts/database/run-migrations";

export function assertSafeIntegrationReset(
  url: string,
  input: Record<string, string | undefined>,
): void {
  try {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.slice(1));
    const identity = {
      projectId: requiredIdentityValue(input.NEON_PROJECT_ID),
      branchId: requiredIdentityValue(input.NEON_BRANCH_ID),
      branchName: requiredIdentityValue(input.NEON_BRANCH_NAME),
      endpointId: requiredIdentityValue(input.NEON_ENDPOINT_ID),
      endpointHostname: requiredIdentityValue(input.NEON_ENDPOINT_HOSTNAME),
      database: requiredIdentityValue(input.NEON_DATABASE_NAME),
    };
    const endpointLabel = identity.endpointHostname.split(".")[0];
    const endpointMatchesId =
      endpointLabel === identity.endpointId ||
      endpointLabel === `${identity.endpointId}-pooler`;
    const forbiddenBranchNames = new Set([
      "default",
      "main",
      "prod",
      "production",
    ]);
    const identityAcknowledgement = [
      identity.projectId,
      identity.branchId,
      identity.branchName,
      identity.endpointId,
      identity.endpointHostname,
      identity.database,
    ].join("|");

    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !identity.endpointHostname.endsWith(".neon.tech") ||
      parsed.hostname !== identity.endpointHostname ||
      !endpointMatchesId ||
      database !== identity.database ||
      !database.endsWith("_test") ||
      input.NEON_BRANCH_IS_DEFAULT !== "false" ||
      forbiddenBranchNames.has(identity.branchName.toLowerCase()) ||
      input.REMOTE_TEST_DATABASE_RESET_ACK !== database ||
      input.REMOTE_TEST_NEON_IDENTITY_ACK !== identityAcknowledgement
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("Refusing destructive integration reset");
  }
}

function requiredIdentityValue(value: string | undefined): string {
  if (!value || value.includes("|")) {
    throw new Error();
  }

  return value;
}

export default async function setup(): Promise<void> {
  const url = readMigrationDatabaseUrl(process.env);
  assertSafeIntegrationReset(url, process.env);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }

  await runMigrations(url);
}
