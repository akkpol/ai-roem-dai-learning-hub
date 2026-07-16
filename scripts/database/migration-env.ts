import { preflightSession002DatabaseTarget } from "./provider-preflight";

export async function readMigrationDatabaseUrl(
  input: Record<string, string | undefined>,
  providerFetch: typeof fetch = fetch,
): Promise<string> {
  return (await preflightSession002DatabaseTarget(input, providerFetch))
    .migrationUrl;
}
