import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: Pool | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Connect the Vercel project to Neon first.");
  }

  if (!database) {
    pool = new Pool({ connectionString });
    database = drizzle({ client: pool, schema });
  }

  return database;
}

export function hasDatabaseConnection() {
  return Boolean(process.env.DATABASE_URL);
}

export async function closeDbConnection() {
  await pool?.end();
  pool = null;
  database = null;
}
