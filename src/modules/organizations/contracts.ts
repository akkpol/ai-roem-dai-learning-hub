export const organizationStatusValues = ["active", "suspended"] as const;
export type OrganizationStatus = (typeof organizationStatusValues)[number];

export const organizationMembershipRoleValues = [
  "owner",
  "manager",
  "member",
] as const;
export type OrganizationMembershipRole =
  (typeof organizationMembershipRoleValues)[number];

export const organizationMembershipStatusValues = ["active", "removed"] as const;
export type OrganizationMembershipStatus =
  (typeof organizationMembershipStatusValues)[number];

export const organizationLocaleValues = ["th-TH", "en-US"] as const;
export type OrganizationLocale = (typeof organizationLocaleValues)[number];

export type CreateOrganizationCommand = {
  displayName: string;
  slug: string;
  description?: string;
  contactEmail: string;
  locale: OrganizationLocale;
  timeZone: string;
};

export type UpdateOrganizationIdentityCommand = {
  organizationId: string;
  displayName: string;
  description: string | null;
  contactEmail: string;
  locale: OrganizationLocale;
  timeZone: string;
  expectedVersion: number;
};

export type OrganizationMembership = {
  organizationId: string;
  accountId: string;
  role: OrganizationMembershipRole;
  status: OrganizationMembershipStatus;
};

export type OrganizationSummaryDto = {
  id: string;
  displayName: string;
  slug: string;
  description: string | null;
  locale: OrganizationLocale;
  timeZone: string;
  status: OrganizationStatus;
};

export type OrganizationCreatedEvent = {
  eventType: "organization.created.v1";
  organizationId: string;
  ownerAccountId: string;
  slug: string;
};

export type OrganizationErrorCode =
  | "invalid_input"
  | "slug_taken"
  | "organization_not_found"
  | "forbidden"
  | "stale_version";

export type OrganizationField =
  | "displayName"
  | "slug"
  | "description"
  | "contactEmail"
  | "locale"
  | "timeZone"
  | "expectedVersion";

export type OrganizationError = {
  code: OrganizationErrorCode;
  field?: OrganizationField;
};
