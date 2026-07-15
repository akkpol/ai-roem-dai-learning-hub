import { describe, expect, it } from "vitest";
import {
  assertInstructorScope,
  normalizeAttendanceBatch,
  learnerRiskLevel,
} from "@/lib/domain/instructor";

describe("instructor delivery scope", () => {
  it("allows only cohorts assigned to the instructor", () => {
    expect(() => assertInstructorScope(["cohort-a", "cohort-b"], "cohort-b")).not.toThrow();
    expect(() => assertInstructorScope(["cohort-a"], "cohort-z")).toThrow("มอบหมาย");
  });

  it("normalizes a batch and rejects duplicate or invalid attendance rows", () => {
    expect(
      normalizeAttendanceBatch([
        { enrollmentId: "enrollment-a", attendancePercent: 100 },
        { enrollmentId: "enrollment-b", attendancePercent: 75 },
      ]),
    ).toHaveLength(2);
    expect(() =>
      normalizeAttendanceBatch([
        { enrollmentId: "enrollment-a", attendancePercent: 80 },
        { enrollmentId: "enrollment-a", attendancePercent: 90 },
      ]),
    ).toThrow("ซ้ำ");
    expect(() =>
      normalizeAttendanceBatch([{ enrollmentId: "enrollment-a", attendancePercent: 101 }]),
    ).toThrow("0–100");
  });

  it("identifies learners needing intervention from progress and attendance", () => {
    expect(learnerRiskLevel({ progressPercent: 18, attendancePercent: 60, overdueAssignments: 1 })).toBe("high");
    expect(learnerRiskLevel({ progressPercent: 45, attendancePercent: 85, overdueAssignments: 0 })).toBe("medium");
    expect(learnerRiskLevel({ progressPercent: 80, attendancePercent: 95, overdueAssignments: 0 })).toBe("low");
  });
});
