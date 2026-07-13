import { describe, expect, it } from "vitest";
import { evaluateCompletion } from "@/lib/domain/completion";

const qualified = {
  requiredLessonsCompleted: 10,
  totalRequiredLessons: 10,
  attendancePercent: 80,
  assignmentPassPercent: 70,
};

describe("evaluateCompletion", () => {
  it("completes an automatic course at all three boundaries", () => {
    expect(evaluateCompletion({ ...qualified, policy: "automatic" })).toEqual({
      status: "completed",
      lessonCompletionPercent: 100,
      qualified: true,
    });
  });

  it("does not qualify when required lessons are incomplete", () => {
    const result = evaluateCompletion({
      ...qualified,
      requiredLessonsCompleted: 9,
      policy: "automatic",
    });

    expect(result.status).toBe("in_progress");
    expect(result.qualified).toBe(false);
  });

  it("does not qualify when attendance is below 80 percent", () => {
    expect(
      evaluateCompletion({ ...qualified, attendancePercent: 79, policy: "automatic" }).qualified,
    ).toBe(false);
  });

  it("does not qualify when assignment passes are below 70 percent", () => {
    expect(
      evaluateCompletion({
        ...qualified,
        assignmentPassPercent: 69,
        policy: "automatic",
      }).qualified,
    ).toBe(false);
  });

  it("waits for instructor approval under admin_approval policy", () => {
    expect(evaluateCompletion({ ...qualified, policy: "admin_approval" }).status).toBe(
      "pending_approval",
    );
    expect(
      evaluateCompletion({ ...qualified, policy: "admin_approval", adminApproved: true }).status,
    ).toBe("completed");
  });
});
