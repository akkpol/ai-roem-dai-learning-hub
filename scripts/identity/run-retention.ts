import { createDatabaseConnection } from "../../src/platform/database/client";
import { readDatabaseConfig } from "../../src/platform/database/config";
import { runIdentityRetention } from "../../src/modules/identity/privacy";

function readOptions(argv: string[]) {
  const execute = argv.includes("--execute");
  if (argv.includes("--dry-run") && execute) {
    throw new Error("retention mode is ambiguous");
  }
  const batchArgument = argv.find((argument) => argument.startsWith("--batch="));
  const batchLimit = batchArgument ? Number(batchArgument.slice("--batch=".length)) : 100;
  return { dryRun: !execute, batchLimit, execute };
}

export function assertSafeRetentionExecution(
  env: NodeJS.ProcessEnv,
  maintenanceUrl: string,
) {
  const environment = env.IDENTITY_RETENTION_ENVIRONMENT;
  if (!environment || environment === "production" || !["development", "test", "preview"].includes(environment)) {
    throw new Error("identity retention requires an explicit non-production environment");
  }
  const target = new URL(maintenanceUrl);
  const database = target.pathname.slice(1);
  const local = target.hostname === "localhost" || target.hostname === "127.0.0.1";
  if (!database || database === "postgres") {
    throw new Error("identity retention target database is unsafe");
  }
  const providerIdentity = local
    ? `local:${target.hostname}/${database}`
    : `${env.NEON_PROJECT_ID ?? ""}:${env.NEON_BRANCH_ID ?? ""}:${target.hostname}/${database}`;
  if (!local && (!env.NEON_PROJECT_ID || !env.NEON_BRANCH_ID)) {
    throw new Error("identity retention provider identity is incomplete");
  }
  if (env.IDENTITY_RETENTION_TARGET_ACK !== providerIdentity) {
    throw new Error("identity retention target acknowledgement does not match");
  }
}

async function main() {
  const maintenanceUrl = process.env.IDENTITY_MAINTENANCE_DATABASE_URL;
  if (!maintenanceUrl) throw new Error("identity maintenance configuration is invalid");
  const options = readOptions(process.argv.slice(2));
  if (options.execute) assertSafeRetentionExecution(process.env, maintenanceUrl);
  const connection = createDatabaseConnection(
    readDatabaseConfig({ ...process.env, DATABASE_URL: maintenanceUrl }),
  );
  try {
    const summary = await runIdentityRetention(connection.db, options);
    console.info("identity.retention.completed", summary);
  } finally {
    await connection.close();
  }
}

main().catch((error: Error) => {
  console.error("identity.retention.failed", { errorName: error.name });
  process.exitCode = 1;
});
