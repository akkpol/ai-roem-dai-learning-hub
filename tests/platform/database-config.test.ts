import { describe, expect, it } from "vitest";
import { parse as parsePostgresConnectionString } from "pg-connection-string";
import { readDatabaseConfig } from "@/platform/database/config";

describe("readDatabaseConfig", () => {
  it("parses postgres and bounded settings", () => {
    expect(
      readDatabaseConfig({
        DATABASE_URL: "postgresql://app:secret@localhost/learning_hub_test",
        DATABASE_POOL_MAX: "12",
      }),
    ).toMatchObject({ poolMax: 12, connectionTimeoutMs: 5000 });
  });

  it("rejects wrong protocol and unsafe pool size", () => {
    expect(() =>
      readDatabaseConfig({ DATABASE_URL: "https://example.com" }),
    ).toThrow();
    expect(() =>
      readDatabaseConfig({
        DATABASE_URL: "postgresql://app:secret@localhost/db",
        DATABASE_POOL_MAX: "101",
      }),
    ).toThrow();
  });

  it.each([undefined, "disable", "allow", "prefer"])(
    "rejects a remote PostgreSQL URL with sslmode=%s",
    (sslmode) => {
      const query = sslmode ? `?sslmode=${sslmode}` : "";
      expect(() =>
        readDatabaseConfig({
          DATABASE_URL: `postgresql://app:secret@db.example.com/learning_hub${query}`,
        }),
      ).toThrow(/TLS/);
    },
  );

  it.each(["require", "verify-ca", "verify-full"])(
    "accepts a remote PostgreSQL URL with sslmode=%s",
    (sslmode) => {
      const url =
        `postgresql://app:secret@db.example.com/learning_hub?sslmode=${sslmode}`;
      expect(readDatabaseConfig({ DATABASE_URL: url }).url).toBe(url);
    },
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "allows the exact loopback host %s without sslmode",
    (hostname) => {
      const url = `postgresql://app:secret@${hostname}/learning_hub_test`;
      expect(readDatabaseConfig({ DATABASE_URL: url }).url).toBe(url);
    },
  );

  it.each(["localhost.example.com", "127.0.0.1.example.com"])(
    "does not extend the loopback exception to %s",
    (hostname) => {
      expect(() =>
        readDatabaseConfig({
          DATABASE_URL: `postgresql://app:secret@${hostname}/learning_hub_test`,
        }),
      ).toThrow(/TLS/);
    },
  );

  it("rejects a query host that overrides the validated URL authority", () => {
    const url =
      "postgresql://app:secret@localhost/learning_hub_test" +
      "?host=remote.example.com";

    expect(parsePostgresConnectionString(url).host).toBe("remote.example.com");
    expect(() => readDatabaseConfig({ DATABASE_URL: url })).toThrow();
  });

  it.each(["hostaddr", "port", "dbname", "database", "user", "password", "ssl"])(
    "rejects non-allowlisted PostgreSQL query option %s",
    (option) => {
      const url =
        "postgresql://app:secret@db.example.com/learning_hub" +
        `?sslmode=require&${option}=forbidden`;
      expect(() => readDatabaseConfig({ DATABASE_URL: url })).toThrow();
    },
  );

  it("allows the approved Neon channel binding option", () => {
    const url =
      "postgresql://app:secret@db.example.com/learning_hub" +
      "?sslmode=verify-full&channel_binding=require";
    expect(readDatabaseConfig({ DATABASE_URL: url }).url).toBe(url);
  });

  it("does not include a rejected URL or secret in its error message", () => {
    const secret = "do-not-disclose";
    const url =
      `postgresql://app:${secret}@localhost/learning_hub_test` +
      "?host=remote.example.com";

    expect(() => readDatabaseConfig({ DATABASE_URL: url })).toThrowError(
      expect.objectContaining({
        message: expect.not.stringContaining(secret),
      }),
    );
    try {
      readDatabaseConfig({ DATABASE_URL: url });
    } catch (error) {
      expect(String(error)).not.toContain(url);
    }
  });
});
