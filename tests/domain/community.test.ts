import { describe, expect, it } from "vitest";
import {
  assertCommunityAccess,
  assertFlatReply,
  assertThreadReplyable,
  canModerateCommunity,
} from "@/lib/domain/community";

describe("cohort community scope", () => {
  it("allows enrolled learners, assigned instructors, and admins only", () => {
    expect(() => assertCommunityAccess({ enrolled: true, assignedInstructor: false, admin: false })).not.toThrow();
    expect(() => assertCommunityAccess({ enrolled: false, assignedInstructor: true, admin: false })).not.toThrow();
    expect(() => assertCommunityAccess({ enrolled: false, assignedInstructor: false, admin: true })).not.toThrow();
    expect(() => assertCommunityAccess({ enrolled: false, assignedInstructor: false, admin: false })).toThrow("รุ่นเรียน");
  });

  it("keeps replies flat and blocks replies on locked threads", () => {
    expect(() => assertFlatReply(null)).not.toThrow();
    expect(() => assertFlatReply("reply-parent")).toThrow("ซ้อน");
    expect(() => assertThreadReplyable("open")).not.toThrow();
    expect(() => assertThreadReplyable("locked")).toThrow("ล็อก");
  });

  it("limits moderation to assigned instructors and admins", () => {
    expect(canModerateCommunity({ assignedInstructor: true, admin: false })).toBe(true);
    expect(canModerateCommunity({ assignedInstructor: false, admin: true })).toBe(true);
    expect(canModerateCommunity({ assignedInstructor: false, admin: false })).toBe(false);
  });
});
