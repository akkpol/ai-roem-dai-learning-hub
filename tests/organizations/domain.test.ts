import { describe, expect, it } from "vitest";

import type { Actor } from "@/modules/identity";
import {
  evaluateOrganizationAuthorization,
  normalizeOrganizationSlug,
  isValidOrganizationSlug,
  type OrganizationMembership,
} from "@/modules/organizations";

const activeActor = (overrides: Partial<Actor> = {}): Actor => ({
  accountId: "00000000-0000-4000-8000-000000000001",
  accountStatus: "active",
  emailVerified: true,
  sessionId: "00000000-0000-4000-8000-000000000002",
  sessionFresh: true,
  mfaState: "verified",
  globalRoles: [],
  ...overrides,
});

const membership = (
  overrides: Partial<OrganizationMembership> = {},
): OrganizationMembership => ({
  organizationId: "00000000-0000-4000-8000-000000000010",
  accountId: "00000000-0000-4000-8000-000000000001",
  role: "owner",
  status: "active",
  ...overrides,
});

describe("organization domain decisions", () => {
  it("normalizes slugs to trimmed lowercase ASCII and validates the published shape", () => {
    expect(normalizeOrganizationSlug("  Learn-Ing-TH  ")).toBe("learn-ing-th");
    expect(isValidOrganizationSlug("learn-ing-th")).toBe(true);
    expect(isValidOrganizationSlug("a")).toBe(false);
    expect(isValidOrganizationSlug("ab")).toBe(false);
    expect(isValidOrganizationSlug("learn_ing")).toBe(false);
    expect(isValidOrganizationSlug("-learning")).toBe(false);
    expect(isValidOrganizationSlug("learning-")).toBe(false);
    expect(isValidOrganizationSlug("สถาบัน")).toBe(false);
  });

  it("allows an active actor to create an organization", () => {
    expect(
      evaluateOrganizationAuthorization({
        actor: activeActor(),
        permission: "organization.create",
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  it("denies suspended and closed actors before checking membership", () => {
    for (const accountStatus of ["suspended", "closed"]) {
      expect(
        evaluateOrganizationAuthorization({
          actor: activeActor({ accountStatus }),
          permission: "organization.identity.update",
          organizationId: "00000000-0000-4000-8000-000000000010",
          membership: membership(),
        }),
      ).toEqual({ allowed: false, reason: "account_inactive" });
    }
  });

  it("allows active owners and managers to edit organization identity", () => {
    for (const role of ["owner", "manager"] as const) {
      expect(
        evaluateOrganizationAuthorization({
          actor: activeActor(),
          permission: "organization.identity.update",
          organizationId: "00000000-0000-4000-8000-000000000010",
          membership: membership({ role }),
        }),
      ).toEqual({ allowed: true, reason: "allowed" });
    }
  });

  it("denies members, removed memberships, and outsiders from identity edits", () => {
    const input = {
      actor: activeActor(),
      permission: "organization.identity.update" as const,
      organizationId: "00000000-0000-4000-8000-000000000010",
    };

    expect(
      evaluateOrganizationAuthorization({
        ...input,
        membership: membership({ role: "member" }),
      }),
    ).toEqual({ allowed: false, reason: "role_insufficient" });
    expect(
      evaluateOrganizationAuthorization({
        ...input,
        membership: membership({ status: "removed" }),
      }),
    ).toEqual({ allowed: false, reason: "membership_inactive" });
    expect(evaluateOrganizationAuthorization(input)).toEqual({
      allowed: false,
      reason: "membership_required",
    });
  });

  it("denies a membership belonging to a different organization", () => {
    expect(
      evaluateOrganizationAuthorization({
        actor: activeActor(),
        permission: "organization.identity.update",
        organizationId: "00000000-0000-4000-8000-000000000010",
        membership: membership({
          organizationId: "00000000-0000-4000-8000-000000000099",
        }),
      }),
    ).toEqual({ allowed: false, reason: "membership_required" });
  });
});
