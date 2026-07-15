import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Learning Studio expansion migration", () => {
  it("backfills multi-role identity, revision snapshots, and pinned delivery data", async () => {
    const sql = await readFile("drizzle/0001_learning-studio-expansion.sql", "utf8");
    expect(sql).toContain('INSERT INTO "member_roles"');
    expect(sql).toContain('INSERT INTO "course_revisions"');
    expect(sql).toContain('UPDATE "cohorts" c\nSET "course_revision_id"');
    expect(sql).toContain('UPDATE "enrollments" e\nSET "course_revision_id"');
  });

  it("keeps legacy profile, course, cohort, reservation, and enrollment structures", async () => {
    const sql = await readFile("drizzle/0001_learning-studio-expansion.sql", "utf8");
    expect(sql).not.toMatch(/drop\s+(table|column|type|schema)/i);
    expect(sql).not.toMatch(/truncate|delete\s+from/i);
  });
});
