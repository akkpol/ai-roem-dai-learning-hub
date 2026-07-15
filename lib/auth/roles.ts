export const memberRoleValues = ["student", "instructor", "admin"] as const;

export type MemberRole = (typeof memberRoleValues)[number];

const roleOrder = new Map<MemberRole, number>(
  memberRoleValues.map((role, index) => [role, index]),
);

export function resolveMemberRoles(
  expandedRoles: readonly MemberRole[],
  legacyRole: MemberRole,
): MemberRole[] {
  const roles = expandedRoles.length > 0 ? expandedRoles : [legacyRole];

  return [...new Set(roles)].sort(
    (left, right) => (roleOrder.get(left) ?? 0) - (roleOrder.get(right) ?? 0),
  );
}

export function hasRole(roles: readonly MemberRole[], role: MemberRole) {
  return roles.includes(role);
}

export function roleLandingPath(role: MemberRole) {
  if (role === "instructor") return "/teach";
  if (role === "admin") return "/admin";
  return "/learn";
}
