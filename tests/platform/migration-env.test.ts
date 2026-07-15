import { describe, expect, it } from "vitest";
import { parse as parsePostgresConnectionString } from "pg-connection-string";
import { readMigrationDatabaseUrl } from "../../scripts/database/migration-env";

const remoteIdentity = {
  NEON_API_KEY: "provider-api-secret",
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

const fetchProviderAuthority: typeof fetch = async (request) => {
  const pathname = new URL(request.toString()).pathname;
  if (pathname.endsWith("/endpoints")) {
    return Response.json({ endpoints: [{
      id: remoteIdentity.NEON_ENDPOINT_ID,
      project_id: remoteIdentity.NEON_PROJECT_ID,
      branch_id: remoteIdentity.NEON_BRANCH_ID,
      host: remoteIdentity.NEON_ENDPOINT_HOSTNAME,
    }] });
  }
  if (pathname.endsWith("/databases")) {
    return Response.json({ databases: [{
      branch_id: remoteIdentity.NEON_BRANCH_ID,
      name: remoteIdentity.NEON_DATABASE_NAME,
    }] });
  }
  return Response.json({ branch: {
    id: remoteIdentity.NEON_BRANCH_ID,
    project_id: remoteIdentity.NEON_PROJECT_ID,
    name: remoteIdentity.NEON_BRANCH_NAME,
    default: false,
  } });
};

function readMigration(
  input: Record<string, string | undefined>,
): Promise<string> {
  return readMigrationDatabaseUrl(input, fetchProviderAuthority);
}

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
  it("accepts a separate postgres migration URL", async () => {
    expect(await readMigration({
      DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
      MIGRATION_DATABASE_URL: "postgresql://migrator:secret@localhost/learning_hub_test",
    })).toContain("migrator");
  });

  it("rejects missing configuration or an identical URL", async () => {
    await expect(readMigration({})).rejects.toThrow();
    const url = "postgresql://same:secret@localhost/learning_hub_test";
    await expect(readMigration({
      DATABASE_URL: url,
      MIGRATION_DATABASE_URL: url,
    })).rejects.toThrow(/must be separate/);
  });

  it("rejects matching login principals despite encoded URLs and query differences", async () => {
    await expect(readMigration(remoteEnvironment(
      "postgresql://%61pp:app-secret@ep-session-002-pooler.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
      "postgresql://app:migration-secret@ep-session-002.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require&channel_binding=require",
    ))).rejects.toThrow(/different PostgreSQL login principals/);
  });

  it("allows distinct login principals across direct and pooled hosts", async () => {
    expect(await readMigration(remoteEnvironment(
      "postgresql://app:app-secret@ep-session-002-pooler.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
      "postgresql://migrator:migration-secret@ep-session-002.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
    ))).toContain("migrator");
  });

  it.each([undefined, "disable", "allow", "prefer"])(
    "rejects a remote migration URL with sslmode=%s",
    async (sslmode) => {
      const query = sslmode ? `?sslmode=${sslmode}` : "";
      await expect(readMigration({
        DATABASE_URL:
          "postgresql://app:app-secret@ep-pooler.example.com/learning_hub_test?sslmode=require",
        MIGRATION_DATABASE_URL:
          `postgresql://migrator:migration-secret@ep-direct.example.com/learning_hub_test${query}`,
      })).rejects.toThrow(/TLS/);
    },
  );

  it.each(["require", "verify-ca", "verify-full"])(
    "accepts a remote migration URL with sslmode=%s",
    async (sslmode) => {
      const migrationUrl =
        "postgresql://migrator:migration-secret@ep-session-002.ap-southeast-1.aws.neon.tech/" +
        `learning_hub_session_002_test?sslmode=${sslmode}`;
      expect(await readMigration(remoteEnvironment(
        "postgresql://app:app-secret@ep-session-002-pooler.ap-southeast-1.aws.neon.tech/learning_hub_session_002_test?sslmode=require",
        migrationUrl,
      ))).toBe(migrationUrl);
    },
  );

  it("rejects a remote application URL without TLS in migration configuration", async () => {
    await expect(readMigration({
      DATABASE_URL:
        "postgresql://app:app-secret@ep-pooler.example.com/learning_hub_test",
      MIGRATION_DATABASE_URL:
        "postgresql://migrator:migration-secret@ep-direct.example.com/learning_hub_test?sslmode=require",
    })).rejects.toThrow(/TLS/);
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "allows exact loopback host %s without sslmode",
    async (hostname) => {
      expect(await readMigration({
        DATABASE_URL: `postgresql://app:secret@${hostname}/learning_hub_test`,
        MIGRATION_DATABASE_URL:
          `postgresql://migrator:secret@${hostname}/learning_hub_test`,
      })).toContain("migrator");
    },
  );

  it("rejects a pg-connection-string effective host override before migration", async () => {
    const migrationUrl =
      "postgresql://migrator:secret@localhost/learning_hub_test" +
      "?host=remote.example.com";
    expect(parsePostgresConnectionString(migrationUrl).host).toBe(
      "remote.example.com",
    );
    await expect(readMigration({
      DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
      MIGRATION_DATABASE_URL: migrationUrl,
    })).rejects.toThrow();
  });

  it("rejects hostaddr overrides before migration", async () => {
    await expect(readMigration({
      DATABASE_URL:
        "postgresql://app:secret@localhost/learning_hub_test?hostaddr=192.0.2.1",
      MIGRATION_DATABASE_URL:
        "postgresql://migrator:secret@localhost/learning_hub_test",
    })).rejects.toThrow();
  });
});
