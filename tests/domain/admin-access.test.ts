import { describe, expect, it } from "vitest";
import { assertCanGrantRole, initialMemberRoles } from "@/lib/domain/access-management";

describe("admin role management", () => {
  it("gives every new member the learner role", () => {
    expect(initialMemberRoles(false)).toEqual(["student"]);
    expect(initialMemberRoles(true)).toEqual(["student", "admin"]);
  });

  it("requires an admin to grant instructor or admin access", () => {
    expect(() => assertCanGrantRole(["student", "admin"], "instructor")).not.toThrow();
    expect(() => assertCanGrantRole(["student", "instructor"], "admin")).toThrow("แอดมิน");
  });
});
