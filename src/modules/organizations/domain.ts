import type { OrganizationMembership } from "./contracts";

export type OrganizationActor = {
  accountId: string;
  accountStatus: string;
};

export type OrganizationPermission =
  | "organization.create"
  | "organization.workspace.read"
  | "organization.identity.update";

export type OrganizationAuthorizationReason =
  | "allowed"
  | "account_inactive"
  | "membership_required"
  | "membership_inactive"
  | "role_insufficient"
  | "permission_denied";

export type OrganizationAuthorizationDecision = {
  allowed: boolean;
  reason: OrganizationAuthorizationReason;
};

export type OrganizationAuthorizationInput = {
  actor: OrganizationActor;
  permission: OrganizationPermission;
  organizationId?: string;
  membership?: OrganizationMembership;
};

const organizationSlugPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const deny = (
  reason: Exclude<OrganizationAuthorizationReason, "allowed">,
): OrganizationAuthorizationDecision => ({ allowed: false, reason });

export function normalizeOrganizationSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidOrganizationSlug(value: string): boolean {
  return organizationSlugPattern.test(value);
}

export function evaluateOrganizationAuthorization(
  input: OrganizationAuthorizationInput,
): OrganizationAuthorizationDecision {
  const { actor, permission, organizationId, membership } = input;
  if (actor.accountStatus !== "active") return deny("account_inactive");
  if (permission === "organization.create") {
    return { allowed: true, reason: "allowed" };
  }
  if (!organizationId || !membership || membership.organizationId !== organizationId) {
    return deny("membership_required");
  }
  if (membership.accountId !== actor.accountId) return deny("membership_required");
  if (membership.status !== "active") return deny("membership_inactive");
  if (permission === "organization.workspace.read") {
    return { allowed: true, reason: "allowed" };
  }
  if (permission === "organization.identity.update") {
    return membership.role === "owner" || membership.role === "manager"
      ? { allowed: true, reason: "allowed" }
      : deny("role_insufficient");
  }
  return deny("permission_denied");
}
