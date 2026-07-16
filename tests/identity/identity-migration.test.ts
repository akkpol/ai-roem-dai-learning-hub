import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "drizzle/0001_identity_authentication.sql",
  "utf8",
);

describe("Identity migration", () => {
  it("creates every SESSION-003 Identity table", () => {
    for (const table of [
      "identity_accounts",
      "identity_auth_factors",
      "identity_sessions",
      "identity_verifications",
      "identity_rate_limits",
      "identity_profiles",
      "identity_policy_acceptances",
      "identity_audit_events",
      "identity_email_outbox",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("keeps minimal application tables append-only for the runtime role", () => {
    expect(migration).toContain(
      "GRANT SELECT, INSERT ON TABLE identity_audit_events TO learning_hub_app",
    );
    expect(migration).toContain(
      "GRANT SELECT, INSERT ON TABLE identity_email_outbox TO learning_hub_app",
    );
    expect(migration).not.toMatch(
      /GRANT[^;]*(UPDATE|DELETE)[^;]*identity_audit_events/i,
    );
  });

  it("does not grant future-table privileges", () => {
    expect(migration).not.toMatch(
      /ALTER DEFAULT PRIVILEGES[\s\S]*GRANT[\s\S]*learning_hub_app/i,
    );
  });
});
