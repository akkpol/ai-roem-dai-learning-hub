import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "drizzle/0005_google_oauth_signup.sql",
  "utf8",
);

describe("Google OAuth signup migration", () => {
  it("removes the age requirement additively", () => {
    expect(migration).toContain(
      'ALTER TABLE "identity_accounts" ALTER COLUMN "age_attested_at" DROP NOT NULL',
    );
    expect(migration).not.toMatch(/DROP COLUMN|DROP TABLE/i);
  });

  it("allows only the explicit Google OAuth audit source on existing actions", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION identity_audit_payload_is_safe");
    expect(migration).toContain("'identity.signup_requested.v1'");
    expect(migration).toContain("'identity.email_verified.v1'");
    expect(migration.match(/\{"source":"google_oauth"\}/g)).toHaveLength(2);
  });
});
