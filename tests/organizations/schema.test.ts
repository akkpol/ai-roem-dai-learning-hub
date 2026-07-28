import { getTableConfig } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  organizationAuditEvents,
  organizationMemberships,
  organizations,
} from "@/modules/organizations/schema";

describe("organization persistence schema", () => {
  it("owns immutable identity, versioning, and membership lifecycle fields", () => {
    const organization = getTableConfig(organizations);
    const membership = getTableConfig(organizationMemberships);

    expect(organization.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "display_name",
        "slug",
        "description",
        "contact_email",
        "locale",
        "time_zone",
        "status",
        "version",
      ]),
    );
    expect(organization.indexes.map((index) => index.config.name)).toContain(
      "organizations_slug_unique",
    );
    expect(membership.indexes.map((index) => index.config.name)).toContain(
      "organization_memberships_active_account_unique",
    );
  });

  it("keeps organization audits separate and append-only in the runtime schema", () => {
    const audit = getTableConfig(organizationAuditEvents);
    expect(audit.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "organization_id",
        "actor_account_id",
        "action",
        "payload",
        "occurred_at",
      ]),
    );
  });

  it("uses narrow runtime grants and blocks contact email in audit payloads", () => {
    const migration = readFileSync("drizzle/0006_organization_workspace.sql", "utf8");
    expect(migration).toContain("organization_audit_payload_is_safe");
    expect(migration).toContain("GRANT SELECT, INSERT (");
    expect(migration).toContain("GRANT UPDATE (");
    expect(migration).toContain("GRANT INSERT (\n  organization_id,\n  actor_account_id");
    expect(migration).not.toMatch(
      /GRANT[^;]*(DELETE|UPDATE)[^;]*organization_audit_events/i,
    );
  });

  it("grants membership reads only to the workspace fields", () => {
    const migration = readFileSync("drizzle/0006_organization_workspace.sql", "utf8");
    expect(migration).toContain(
      "GRANT SELECT (\n  organization_id,\n  account_id,\n  role,\n  status\n) ON TABLE organization_memberships TO learning_hub_app",
    );
    expect(migration).not.toContain(
      "GRANT SELECT ON TABLE organization_memberships TO learning_hub_app",
    );
  });
});
