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

  it("creates revision conflict targets before running revision backfills", async () => {
    const sql = await readFile("drizzle/0001_learning-studio-expansion.sql", "utf8");
    const revisionIndex = sql.indexOf('CREATE UNIQUE INDEX "course_revisions_course_number_unique"');
    const moduleIndex = sql.indexOf('CREATE UNIQUE INDEX "course_modules_revision_sort_unique"');
    const revisionBackfill = sql.indexOf('INSERT INTO "course_revisions"');
    const moduleBackfill = sql.indexOf('INSERT INTO "course_modules"');

    expect(revisionIndex).toBeGreaterThan(-1);
    expect(moduleIndex).toBeGreaterThan(-1);
    expect(revisionIndex).toBeLessThan(revisionBackfill);
    expect(moduleIndex).toBeLessThan(moduleBackfill);
  });
});
