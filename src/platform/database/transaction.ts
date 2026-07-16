import type { AppDatabase } from "./client";

export type DatabaseTransaction =
  Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export function withTransaction<T>(
  database: AppDatabase,
  work: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return database.transaction(work);
}
