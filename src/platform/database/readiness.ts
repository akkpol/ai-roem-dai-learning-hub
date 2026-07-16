import { sql } from "drizzle-orm";

import type { AppDatabase } from "./client";

export async function probeDatabase(
  db: Pick<AppDatabase, "execute">,
): Promise<void> {
  await db.execute(sql`select 1`);
}
