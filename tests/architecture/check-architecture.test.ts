import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkArchitecture } from "../../scripts/check-architecture.mjs";

function fixture() {
  return mkdtempSync(path.join(tmpdir(), "learning-hub-architecture-"));
}

function write(root: string, relativePath: string, contents = "export {};") {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

describe("checkArchitecture", () => {
  it("accepts imports through a module public contract", () => {
    const root = fixture();
    write(root, "src/modules/catalog/index.ts", "export const catalog = true;");
    write(root, "src/app/page.tsx", 'import { catalog } from "@/modules/catalog"; void catalog;');
    expect(checkArchitecture(root)).toEqual([]);
  });

  it("rejects legacy root source directories", () => {
    const root = fixture();
    write(root, "lib/legacy.ts");
    expect(checkArchitecture(root)).toContain("Legacy root directory is forbidden: lib");
  });

  it("rejects deep imports into another module", () => {
    const root = fixture();
    write(root, "src/modules/catalog/domain/course.ts", "export const course = true;");
    write(
      root,
      "src/modules/enrollments/application/grant.ts",
      'import { course } from "@/modules/catalog/domain/course"; void course;',
    );
    expect(checkArchitecture(root)[0]).toMatch(/Deep cross-module import is forbidden/);
  });

  it("rejects migration credentials in runtime source", () => {
    const root = fixture();
    write(root, "src/platform/database/client.ts", "void process.env.MIGRATION_DATABASE_URL;");
    expect(checkArchitecture(root)[0]).toMatch(/Migration credential is forbidden/);
  });

  it("rejects migration runners in runtime source", () => {
    const root = fixture();
    write(
      root,
      "src/platform/database/client.ts",
      'import { migrate } from "drizzle-orm/node-postgres/migrator"; void migrate;',
    );
    expect(checkArchitecture(root)[0]).toMatch(/Migration runner is forbidden/);
  });
});
