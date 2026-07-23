import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  identityAuditEvents,
  identityGlobalRoleGrants,
} from "@/modules/identity/schema";

describe("SESSION-005 schema contract", () => {
  it("defines lifecycle-rich global role grants", () => {
    const config = getTableConfig(identityGlobalRoleGrants);
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "role",
        "granted_by_account_id",
        "revoked_by_account_id",
        "reason_code",
        "starts_at",
        "expires_at",
        "revoked_at",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "identity_global_role_grants_unrevoked_unique",
    );
  });

  it("records the audit actor and reason separately from the target account", () => {
    const config = getTableConfig(identityAuditEvents);
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "actor_type",
        "actor_account_id",
        "reason_code",
        "correlation_id",
      ]),
    );
  });
});
