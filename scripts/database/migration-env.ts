import { z } from "zod";

const postgresUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
}, "Expected a PostgreSQL URL");

export function readMigrationDatabaseUrl(
  input: Record<string, string | undefined>,
): string {
  const databaseUrl = postgresUrl.parse(input.DATABASE_URL);
  const migrationUrl = postgresUrl.parse(input.MIGRATION_DATABASE_URL);

  if (databaseUrl === migrationUrl) {
    throw new Error("MIGRATION_DATABASE_URL must be separate from DATABASE_URL");
  }

  if (postgresLoginPrincipal(databaseUrl) === postgresLoginPrincipal(migrationUrl)) {
    throw new Error("MIGRATION_DATABASE_URL and DATABASE_URL must use different PostgreSQL login principals");
  }

  return migrationUrl;
}

function postgresLoginPrincipal(url: string): string {
  return decodeURIComponent(new URL(url).username);
}
