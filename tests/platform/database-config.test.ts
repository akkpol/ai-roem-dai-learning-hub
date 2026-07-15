import { describe, expect, it } from "vitest";
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
});
