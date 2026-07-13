import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationDir = new URL("../drizzle/", import.meta.url);
const files = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
const destructive = /\b(drop\s+(table|schema|type|column|constraint)|truncate|delete\s+from)\b/i;
const violations = [];

for (const file of files) {
  const content = await readFile(new URL(file, migrationDir), "utf8");
  if (destructive.test(content)) violations.push(join("drizzle", file));
}

if (violations.length > 0) {
  console.error(`Destructive migration statements require a dedicated reviewed workflow: ${violations.join(", ")}`);
  process.exit(1);
}

console.log(`Migration safety check passed for ${files.length} SQL file(s).`);
