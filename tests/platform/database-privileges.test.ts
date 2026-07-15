import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../drizzle/0000_platform_event_outbox.sql", import.meta.url),
  "utf8",
);

describe("application database privileges", () => {
  it("grants only the event writes required by current callers", () => {
    expect(migration).toContain(
      "GRANT INSERT ON TABLE platform_event_outbox TO learning_hub_app;",
    );
    expect(migration).toContain(
      "GRANT INSERT ON TABLE platform_event_consumptions TO learning_hub_app;",
    );
    expect(migration).toContain(
      "GRANT SELECT (event_id) ON TABLE platform_event_consumptions TO learning_hub_app;",
    );
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
