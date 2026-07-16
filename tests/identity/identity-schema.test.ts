import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  betterAuthSchema,
  identityAccounts,
  identityAuditEvents,
  identityEmailOutbox,
  identityPolicyAcceptances,
  identityProfiles,
} from "@/modules/identity/schema";

describe("Identity schema", () => {
  it("maps Better Auth core models to Identity-owned tables", () => {
    expect(Object.fromEntries(
      Object.entries(betterAuthSchema).map(([model, table]) => [
        model,
        getTableName(table),
      ]),
    )).toEqual({
      user: "identity_accounts",
      account: "identity_auth_factors",
      session: "identity_sessions",
      verification: "identity_verifications",
      rateLimit: "identity_rate_limits",
    });
  });

  it("keeps required account and atomic signup fields", () => {
    expect(Object.keys(getTableColumns(identityAccounts))).toEqual(
      expect.arrayContaining([
        "id",
        "email",
        "emailVerified",
        "status",
        "ageAttestedAt",
      ]),
    );
    expect(getTableName(identityProfiles)).toBe("identity_profiles");
    expect(getTableName(identityPolicyAcceptances)).toBe(
      "identity_policy_acceptances",
    );
    expect(getTableName(identityAuditEvents)).toBe("identity_audit_events");
  });

  it("stores encrypted email intent without plaintext payload columns", () => {
    const columns = Object.keys(getTableColumns(identityEmailOutbox));
    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "recipientHash",
        "encryptedPayload",
        "keyVersion",
        "idempotencyKey",
      ]),
    );
    expect(columns).not.toEqual(
      expect.arrayContaining(["token", "password", "html", "recipientEmail"]),
    );
  });
});
