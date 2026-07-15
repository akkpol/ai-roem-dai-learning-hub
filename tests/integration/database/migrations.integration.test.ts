import { Client } from "pg";
import { expect, it } from "vitest";

import { readMigrationDatabaseUrl } from "../../../scripts/database/migration-env";
import { runMigrations } from "../../../scripts/database/run-migrations";

it("migrates an empty database and repeats safely", async () => {
  const url = readMigrationDatabaseUrl(process.env);
  await runMigrations(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<{ name: string }>(
      "select to_regclass('public.platform_event_outbox')::text as name",
    );
    expect(result.rows[0]?.name).toBe("platform_event_outbox");
  } finally {
    await client.end();
  }
});
