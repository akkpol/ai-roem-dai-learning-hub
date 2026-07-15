import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { readDatabaseConfig, type DatabaseConfig } from "./config";
import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

export type DatabaseConnection = {
  db: AppDatabase;
  pool: Pool;
  close(): Promise<void>;
};

export function createDatabaseConnection(
  config: DatabaseConfig,
): DatabaseConnection {
  const pool = new Pool({
    connectionString: config.url,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    query_timeout: config.queryTimeoutMs,
    statement_timeout: config.queryTimeoutMs,
    application_name: "learning-hub",
  });

  pool.on("error", (error: Error & { code?: string }) => {
    console.error("database.pool.idle_client_error", {
      errorName: error.name,
      errorCode: error.code ?? "unknown",
    });
  });

  return {
    db: drizzle({ client: pool, schema }),
    pool,
    close: () => pool.end(),
  };
}

const cache = globalThis as typeof globalThis & {
  learningHubDatabase?: DatabaseConnection;
};

export function getRuntimeDatabaseConnection(): DatabaseConnection {
  cache.learningHubDatabase ??= createDatabaseConnection(
    readDatabaseConfig(process.env),
  );

  return cache.learningHubDatabase;
}
