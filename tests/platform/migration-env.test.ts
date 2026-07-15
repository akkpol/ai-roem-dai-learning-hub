import { describe, expect, it } from "vitest";
import { readMigrationDatabaseUrl } from "../../scripts/database/migration-env";

describe("readMigrationDatabaseUrl", () => {
  it("accepts a separate postgres migration URL", () => {
    expect(readMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
      MIGRATION_DATABASE_URL: "postgresql://migrator:secret@localhost/learning_hub_test",
    })).toContain("migrator");
  });

  it("rejects missing or shared credentials", () => {
    expect(() => readMigrationDatabaseUrl({})).toThrow();
    const url = "postgresql://same:secret@localhost/learning_hub_test";
    expect(() => readMigrationDatabaseUrl({
      DATABASE_URL: url,
      MIGRATION_DATABASE_URL: url,
    })).toThrow(/must be separate/);
  });
});
