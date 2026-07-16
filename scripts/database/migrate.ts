import { readMigrationDatabaseUrl } from "./migration-env";
import { runMigrations } from "./run-migrations";

try {
  const migrationUrl = await readMigrationDatabaseUrl(process.env);
  await runMigrations(migrationUrl);
  console.info("database.migration.completed");
} catch (error) {
  console.error("database.migration.failed", {
    errorName: error instanceof Error ? error.name : "unknown",
  });
  process.exitCode = 1;
}
