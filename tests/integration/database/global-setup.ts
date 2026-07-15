import { Client } from "pg";

import {
  assertSafeIntegrationReset,
} from "../../../scripts/database/provider-preflight";
import { runMigrations } from "../../../scripts/database/run-migrations";

export { assertSafeIntegrationReset };

export default async function setup(): Promise<void> {
  const target = assertSafeIntegrationReset(
    process.env.MIGRATION_DATABASE_URL ?? "",
    process.env,
  );
  const url = target.migrationUrl;

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
