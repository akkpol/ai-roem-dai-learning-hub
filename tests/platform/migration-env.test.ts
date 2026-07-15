import { describe, expect, it } from "vitest";
import { parse as parsePostgresConnectionString } from "pg-connection-string";
import { readMigrationDatabaseUrl } from "../../scripts/database/migration-env";

const remoteIdentity = {
  NEON_PROJECT_ID: "raspy-feather-85795196",
  NEON_BRANCH_ID: "br-session-002",
  NEON_BRANCH_NAME: "session-002-580e95d2",
  NEON_BRANCH_IS_DEFAULT: "false",
  NEON_ENDPOINT_ID: "ep-session-002",
  NEON_ENDPOINT_HOSTNAME: "ep-session-002.ap-southeast-1.aws.neon.tech",
  NEON_DATABASE_NAME: "learning_hub_session_002_test",
  SESSION_002_APPROVED_NEON_BRANCH_ID: "br-session-002",
  SESSION_002_APPROVED_NEON_BRANCH_NAME: "session-002-580e95d2",
  SESSION_002_APPROVED_NEON_ENDPOINT_ID: "ep-session-002",
  SESSION_002_APPROVED_NEON_ENDPOINT_HOSTNAME:
    "ep-session-002.ap-southeast-1.aws.neon.tech",
  SESSION_002_APPROVED_NEON_DATABASE_NAME: "learning_hub_session_002_test",
};

function remoteEnvironment(
  applicationUrl: string,
  migrationUrl: string,
): Record<string, string | undefined> {
  return {
    ...remoteIdentity,
    DATABASE_URL: applicationUrl,
    MIGRATION_DATABASE_URL: migrationUrl,
  };
}

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
    expect(() => readMigrationDatabaseUrl(remoteEnvironment(
      "postgresql://%61pp:app-secret@ep-session-002-pooler.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
      "postgresql://app:migration-secret@ep-session-002.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require&channel_binding=require",
    ))).toThrow(/different PostgreSQL login principals/);
  });

  it("allows distinct login principals across direct and pooled hosts", () => {
    expect(readMigrationDatabaseUrl(remoteEnvironment(
      "postgresql://app:app-secret@ep-session-002-pooler.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
      "postgresql://migrator:migration-secret@ep-session-002.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
    ))).toContain("migrator");
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
        "postgresql://migrator:migration-secret@ep-session-002.ap-southeast-1.aws.neon.tech/" +
        `learning_hub_session_002_test?sslmode=${sslmode}`;
      expect(readMigrationDatabaseUrl(remoteEnvironment(
        "postgresql://app:app-secret@ep-session-002-pooler.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
        migrationUrl,
      ))).toBe(migrationUrl);
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

  it("rejects a pg-connection-string effective host override before migration", () => {
    const migrationUrl =
      "postgresql://migrator:secret@localhost/learning_hub_test" +
      "?host=remote.example.com";
    expect(parsePostgresConnectionString(migrationUrl).host).toBe(
      "remote.example.com",
    );
    expect(() => readMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
      MIGRATION_DATABASE_URL: migrationUrl,
    })).toThrow();
  });

  it("rejects hostaddr overrides before migration", () => {
    expect(() => readMigrationDatabaseUrl({
      DATABASE_URL:
        "postgresql://app:secret@localhost/learning_hub_test?hostaddr=192.0.2.1",
      MIGRATION_DATABASE_URL:
        "postgresql://migrator:secret@localhost/learning_hub_test",
    })).toThrow();
  });
});
