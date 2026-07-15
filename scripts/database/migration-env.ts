import { preflightSession002DatabaseTarget } from "./provider-preflight";

export function readMigrationDatabaseUrl(
  input: Record<string, string | undefined>,
): string {
  return preflightSession002DatabaseTarget(input).migrationUrl;
}
