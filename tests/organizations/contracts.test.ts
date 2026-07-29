import { describe, expect, it } from "vitest";

import {
  organizationMembershipRoleValues,
  organizationMembershipStatusValues,
  organizationStatusValues,
  type CreateOrganizationCommand,
  type OrganizationCreatedEvent,
  type OrganizationError,
  type OrganizationSummaryDto,
  type UpdateOrganizationIdentityCommand,
} from "@/modules/organizations";

describe("organization public contracts", () => {
  it("publishes the approved organization and membership state values", () => {
    expect(organizationStatusValues).toEqual(["active", "suspended"]);
    expect(organizationMembershipRoleValues).toEqual([
      "owner",
      "manager",
      "member",
    ]);
    expect(organizationMembershipStatusValues).toEqual(["active", "removed"]);
  });

  it("keeps create and identity-update commands explicit and immutable-slug safe", () => {
    const create: CreateOrganizationCommand = {
      displayName: "โรงเรียนเรียนรู้",
      slug: "learning-school",
      description: "องค์กรเพื่อการเรียนรู้",
      contactEmail: "contact@example.test",
      locale: "th-TH",
      timeZone: "Asia/Bangkok",
    };
    const update: UpdateOrganizationIdentityCommand = {
      organizationId: "00000000-0000-4000-8000-000000000010",
      displayName: "Learning School",
      description: null,
      contactEmail: "contact@example.test",
      locale: "en-US",
      timeZone: "Asia/Bangkok",
      expectedVersion: 2,
    };

    expect(create.slug).toBe("learning-school");
    expect("slug" in update).toBe(false);
  });

  it("keeps summary DTOs and creation events free of contact email", () => {
    const summary: OrganizationSummaryDto = {
      id: "00000000-0000-4000-8000-000000000010",
      displayName: "Learning School",
      slug: "learning-school",
      description: null,
      locale: "th-TH",
      timeZone: "Asia/Bangkok",
      status: "active",
    };
    const event: OrganizationCreatedEvent = {
      eventType: "organization.created.v1",
      organizationId: summary.id,
      ownerAccountId: "00000000-0000-4000-8000-000000000001",
      slug: summary.slug,
    };

    expect(JSON.stringify(summary)).not.toContain("contact@example.test");
    expect(JSON.stringify(event)).not.toContain("contact@example.test");
  });

  it("uses stable safe error codes and optional field attribution", () => {
    const error: OrganizationError = {
      code: "slug_taken",
      field: "slug",
    };

    expect(error).toEqual({ code: "slug_taken", field: "slug" });
  });
});
