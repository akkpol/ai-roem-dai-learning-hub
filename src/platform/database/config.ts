import { z } from "zod";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const remoteTlsModes = new Set(["require", "verify-ca", "verify-full"]);

const integer = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const schema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      "DATABASE_URL must use PostgreSQL",
    ),
  DATABASE_POOL_MAX: integer(10, 1, 100),
  DATABASE_CONNECTION_TIMEOUT_MS: integer(5000, 100, 60_000),
  DATABASE_IDLE_TIMEOUT_MS: integer(30_000, 1000, 300_000),
  DATABASE_QUERY_TIMEOUT_MS: integer(10_000, 100, 120_000),
});

export type DatabaseConfig = {
  url: string;
  poolMax: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  queryTimeoutMs: number;
};

export function readDatabaseConfig(
  input: Record<string, string | undefined>,
): DatabaseConfig {
  const value = schema.parse(input);
  assertPostgresUrlTls(value.DATABASE_URL, "DATABASE_URL");

  return {
    url: value.DATABASE_URL,
    poolMax: value.DATABASE_POOL_MAX,
    connectionTimeoutMs: value.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMs: value.DATABASE_IDLE_TIMEOUT_MS,
    queryTimeoutMs: value.DATABASE_QUERY_TIMEOUT_MS,
  };
}

export function assertPostgresUrlTls(value: string, variableName: string): void {
  const parsed = new URL(value);
  if (loopbackHosts.has(parsed.hostname.toLowerCase())) {
    return;
  }

  const tlsModes = parsed.searchParams.getAll("sslmode");
  if (tlsModes.length !== 1 || !remoteTlsModes.has(tlsModes[0])) {
    throw new Error(
      `${variableName} must enforce TLS for remote PostgreSQL hosts`,
    );
  }
}
