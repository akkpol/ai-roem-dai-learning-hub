import { z } from "zod";

const postgresUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
}, "Expected a PostgreSQL URL");

export function readMigrationDatabaseUrl(
  input: Record<string, string | undefined>,
): string {
  const migrationUrl = postgresUrl.parse(input.MIGRATION_DATABASE_URL);

  if (input.DATABASE_URL === migrationUrl) {
    throw new Error("MIGRATION_DATABASE_URL must be separate from DATABASE_URL");
  }

  return migrationUrl;
}
