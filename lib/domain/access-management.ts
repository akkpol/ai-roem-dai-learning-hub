import { hasRole, type MemberRole } from "@/lib/auth/roles";

export function initialMemberRoles(bootstrapAdmin: boolean): MemberRole[] {
  return bootstrapAdmin ? ["student", "admin"] : ["student"];
}

export function assertCanGrantRole(actorRoles: readonly MemberRole[], targetRole: MemberRole) {
  void targetRole;
  if (!hasRole(actorRoles, "admin")) {
    throw new Error("เฉพาะแอดมินเท่านั้นที่ให้สิทธิ์ผู้สอนหรือแอดมินได้");
  }
}
