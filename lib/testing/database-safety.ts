const ALLOWED_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const TEST_DATABASE_NAME = "closed_beta_test";

export function assertSafeTestDatabase(
  connectionString: string,
  confirmation: string | undefined,
) {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!ALLOWED_TEST_HOSTS.has(url.hostname)) {
    throw new Error("Destructive database tests require a local PostgreSQL host");
  }
  if (databaseName !== TEST_DATABASE_NAME) {
    throw new Error(`Destructive database tests require database ${TEST_DATABASE_NAME}`);
  }
  if (confirmation !== TEST_DATABASE_NAME) {
    throw new Error(`Destructive database tests require confirmation ${TEST_DATABASE_NAME}`);
  }
}

