import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../drizzle/0000_platform_event_outbox.sql", import.meta.url),
  "utf8",
);
const outboxIntegration = readFileSync(
  new URL("../integration/database/outbox.integration.test.ts", import.meta.url),
  "utf8",
);

describe("application database privileges", () => {
  it("grants only the event writes required by current callers", () => {
    expect(migration).toContain(
      "GRANT INSERT (id, event_type, aggregate_type, aggregate_id, payload, occurred_at, available_at) ON TABLE platform_event_outbox TO learning_hub_app;",
    );
    expect(migration).toContain(
      "GRANT INSERT (consumer_name, event_id) ON TABLE platform_event_consumptions TO learning_hub_app;",
    );
    expect(migration).toContain(
      "GRANT SELECT (event_id) ON TABLE platform_event_consumptions TO learning_hub_app;",
    );
  });

  it("does not grant INSERT on protected lifecycle or audit columns", () => {
    expect(migration).not.toMatch(
      /GRANT\s+INSERT\s+ON\s+TABLE\s+platform_event_(?:outbox|consumptions)/i,
    );
    const insertGrants = migration
      .split("\n")
      .filter((line) => line.startsWith("GRANT INSERT ("))
      .join("\n");
    for (const column of [
      "state",
      "attempt_count",
      "claimed_at",
      "published_at",
      "last_error_code",
      "created_at",
      "consumed_at",
    ]) {
      expect(insertGrants).not.toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("keeps runtime outbox SELECT denied and uses a migration observer", () => {
    expect(migration).not.toMatch(
      /GRANT\s+SELECT(?:\s*\([^)]*\))?\s+ON\s+TABLE\s+platform_event_outbox/i,
    );
    expect(outboxIntegration).toContain("MIGRATION_DATABASE_URL");
    expect(outboxIntegration).toContain("observerClient");
  });

  it("does not grant mutable access to current or future tables", () => {
    expect(migration).not.toMatch(/GRANT[^;]*\bUPDATE\b/i);
    expect(migration).not.toMatch(/GRANT[^;]*\bDELETE\b/i);
    expect(migration).not.toMatch(
      /ALTER DEFAULT PRIVILEGES[^;]*GRANT[^;]*ON TABLES/i,
    );
    expect(migration).toContain(
      "REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM learning_hub_app;",
    );
    expect(migration).toContain(
      "REVOKE USAGE, SELECT ON SEQUENCES FROM learning_hub_app;",
    );
  });
});
