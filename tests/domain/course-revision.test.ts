import { describe, expect, it } from "vitest";
import {
  assertRevisionEditable,
  assertRevisionTransition,
  getNextRevisionNumber,
  validateRevisionDraft,
} from "@/lib/domain/course-revision";

describe("course revision workflow", () => {
  it("allows authors to submit drafts and resubmit requested changes", () => {
    expect(() => assertRevisionTransition("draft", "in_review")).not.toThrow();
    expect(() => assertRevisionTransition("changes_requested", "in_review")).not.toThrow();
  });

  it("allows admins to approve or return an in-review revision", () => {
    expect(() => assertRevisionTransition("in_review", "approved")).not.toThrow();
    expect(() => assertRevisionTransition("in_review", "changes_requested")).not.toThrow();
  });

  it("rejects direct publication and edits to approved snapshots", () => {
    expect(() => assertRevisionTransition("draft", "approved")).toThrow("สถานะ");
    expect(() => assertRevisionEditable("approved")).toThrow("revision ใหม่");
    expect(() => assertRevisionEditable("draft")).not.toThrow();
  });

  it("assigns a monotonic revision number", () => {
    expect(getNextRevisionNumber([])).toBe(1);
    expect(getNextRevisionNumber([1, 3, 2])).toBe(4);
  });

  it("reports curriculum validation issues before review", () => {
    expect(
      validateRevisionDraft({
        title: " ",
        summary: "สั้น",
        modules: [{ title: "บทนำ", lessonCount: 0 }],
        assignmentCount: 0,
      }),
    ).toEqual([
      "กรุณาระบุชื่อคอร์ส",
      "คำอธิบายคอร์สควรมีอย่างน้อย 20 ตัวอักษร",
      "ทุก module ต้องมีอย่างน้อย 1 บทเรียน",
    ]);
  });
});
