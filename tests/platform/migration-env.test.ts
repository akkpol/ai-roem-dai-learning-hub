import { describe, expect, it } from "vitest";
import { readMigrationDatabaseUrl } from "../../scripts/database/migration-env";

describe("readMigrationDatabaseUrl", () => {
  it("accepts a separate postgres migration URL", () => {
    expect(readMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
      MIGRATION_DATABASE_URL: "postgresql://migrator:secret@localhost/learning_hub_test",
    })).toContain("migrator");
  });

  it("rejects missing configuration or an identical URL", () => {
    expect(() => readMigrationDatabaseUrl({})).toThrow();
    const url = "postgresql://same:secret@localhost/learning_hub_test";
    expect(() => readMigrationDatabaseUrl({
      DATABASE_URL: url,
      MIGRATION_DATABASE_URL: url,
    })).toThrow(/must be separate/);
  });

  it("rejects matching login principals despite encoded URLs and query differences", () => {
    expect(() => readMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://%61pp:app-secret@ep-direct.example.com/learning_hub_test?sslmode=require",
      MIGRATION_DATABASE_URL: "postgresql://app:migration-secret@ep-pooler.example.com/learning_hub_test?connect_timeout=10&sslmode=require",
    })).toThrow(/different PostgreSQL login principals/);
  });

  it("allows distinct login principals across direct and pooled hosts", () => {
    expect(readMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://app:app-secret@ep-direct.example.com/learning_hub_test?sslmode=require",
      MIGRATION_DATABASE_URL: "postgresql://migrator:migration-secret@ep-pooler.example.com/learning_hub_test?sslmode=require",
    })).toContain("migrator");
  });

  it.each([undefined, "disable", "allow", "prefer"])(
    "rejects a remote migration URL with sslmode=%s",
    (sslmode) => {
      const query = sslmode ? `?sslmode=${sslmode}` : "";
      expect(() => readMigrationDatabaseUrl({
        DATABASE_URL:
          "postgresql://app:app-secret@ep-pooler.example.com/learning_hub_test?sslmode=require",
        MIGRATION_DATABASE_URL:
          `postgresql://migrator:migration-secret@ep-direct.example.com/learning_hub_test${query}`,
      })).toThrow(/TLS/);
    },
  );

  it.each(["require", "verify-ca", "verify-full"])(
    "accepts a remote migration URL with sslmode=%s",
    (sslmode) => {
      const migrationUrl =
        "postgresql://migrator:migration-secret@ep-direct.example.com/" +
        `learning_hub_test?sslmode=${sslmode}`;
      expect(readMigrationDatabaseUrl({
        DATABASE_URL:
          "postgresql://app:app-secret@ep-pooler.example.com/learning_hub_test?sslmode=require",
        MIGRATION_DATABASE_URL: migrationUrl,
      })).toBe(migrationUrl);
    },
  );

  it("rejects a remote application URL without TLS in migration configuration", () => {
    expect(() => readMigrationDatabaseUrl({
      DATABASE_URL:
        "postgresql://app:app-secret@ep-pooler.example.com/learning_hub_test",
      MIGRATION_DATABASE_URL:
        "postgresql://migrator:migration-secret@ep-direct.example.com/learning_hub_test?sslmode=require",
    })).toThrow(/TLS/);
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "allows exact loopback host %s without sslmode",
    (hostname) => {
      expect(readMigrationDatabaseUrl({
        DATABASE_URL: `postgresql://app:secret@${hostname}/learning_hub_test`,
        MIGRATION_DATABASE_URL:
          `postgresql://migrator:secret@${hostname}/learning_hub_test`,
      })).toContain("migrator");
    },
  );
});
