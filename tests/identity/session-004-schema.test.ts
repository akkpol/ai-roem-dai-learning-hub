import { getTableColumns, getTableName } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  betterAuthSchema,
  identityAccountDeletionRequests,
  identityAccounts,
  identityTwoFactors,
} from "@/modules/identity/schema";

describe("SESSION-004 Identity schema", () => {
  it("maps the documented Better Auth 2FA model", () => {
    expect(getTableName(betterAuthSchema.twoFactor)).toBe("identity_two_factors");
    expect(getTableName(identityTwoFactors)).toBe("identity_two_factors");
    expect(Object.keys(getTableColumns(identityTwoFactors))).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "secret",
        "backupCodes",
        "verified",
        "failedVerificationCount",
        "lockedUntil",
      ]),
    );
    expect(Object.keys(getTableColumns(identityAccounts))).toEqual(
      expect.arrayContaining(["twoFactorEnabled", "closedAt"]),
    );
  });

  it("owns a complete deletion request state record", () => {
    expect(getTableName(identityAccountDeletionRequests)).toBe(
      "identity_account_deletion_requests",
    );
    expect(Object.keys(getTableColumns(identityAccountDeletionRequests))).toEqual(
      expect.arrayContaining([
        "id",
        "accountId",
        "state",
        "confirmationTokenHash",
        "confirmationExpiresAt",
        "requestedAt",
        "confirmedAt",
        "scheduledFor",
        "cancelledAt",
        "completedAt",
      ]),
    );
  });

  it("keeps application and maintenance privileges separate", () => {
    const migration = readFileSync(
      "drizzle/0002_identity_profile_security_privacy.sql",
      "utf8",
    );
    expect(migration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE identity_two_factors TO learning_hub_app",
    );
    expect(migration).toContain("CREATE ROLE learning_hub_identity_maintenance NOLOGIN");
    expect(migration).toContain("identity_audit_events");
    expect(migration).toContain("TO learning_hub_identity_maintenance");
    expect(migration).not.toMatch(
      /GRANT[^;]*DELETE[^;]*identity_audit_events[^;]*TO learning_hub_app/i,
    );
  });
});
