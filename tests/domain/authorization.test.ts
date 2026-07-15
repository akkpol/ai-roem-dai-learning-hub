import { describe, expect, it } from "vitest";
import {
  hasRole,
  resolveMemberRoles,
  roleLandingPath,
  type MemberRole,
} from "@/lib/auth/roles";

describe("multi-role authorization", () => {
  it("uses expanded roles and ignores the legacy fallback when rows exist", () => {
    expect(resolveMemberRoles(["instructor", "admin"], "student")).toEqual([
      "instructor",
      "admin",
    ]);
  });

  it("falls back to the legacy profile role during the expansion release", () => {
    expect(resolveMemberRoles([], "instructor")).toEqual(["instructor"]);
  });

  it("deduplicates roles in a stable learner, instructor, admin order", () => {
    const roles: MemberRole[] = ["admin", "student", "admin", "instructor"];

    expect(resolveMemberRoles(roles, "student")).toEqual([
      "student",
      "instructor",
      "admin",
    ]);
  });

  it("fails closed when a role is not granted", () => {
    expect(hasRole(["student"], "admin")).toBe(false);
    expect(hasRole(["student", "instructor"], "instructor")).toBe(true);
  });

  it("maps workspace roles to URL-based landing routes", () => {
    expect(roleLandingPath("student")).toBe("/learn");
    expect(roleLandingPath("instructor")).toBe("/teach");
    expect(roleLandingPath("admin")).toBe("/admin");
  });
});
