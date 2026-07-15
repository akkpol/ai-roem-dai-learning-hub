import { Client } from "pg";

import { readMigrationDatabaseUrl } from "../../../scripts/database/migration-env";
import { runMigrations } from "../../../scripts/database/run-migrations";

export function assertSafeIntegrationReset(
  url: string,
  input: Record<string, string | undefined>,
): void {
  const parsed = new URL(url);
  const name = parsed.pathname.slice(1);
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  const remoteAck = input.REMOTE_TEST_DATABASE_RESET_ACK === name;

  if (!name.endsWith("_test") || (!local && !remoteAck)) {
    throw new Error("Refusing destructive integration reset");
  }
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
