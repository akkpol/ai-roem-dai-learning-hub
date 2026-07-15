import { describe, expect, it } from "vitest";
import { selectNextAction } from "@/lib/domain/learner-next-action";

describe("learner next action priority", () => {
  it("prioritizes expiring payment before classroom work", () => {
    expect(selectNextAction([
      { kind: "session", dueAt: new Date("2026-07-15T12:00:00.000Z") },
      { kind: "payment", dueAt: new Date("2026-07-16T03:00:00.000Z") },
    ])?.kind).toBe("payment");
  });

  it("uses due date within the same priority and returns null when empty", () => {
    expect(selectNextAction([
      { kind: "assignment", dueAt: new Date("2026-07-20T12:00:00.000Z") },
      { kind: "assignment", dueAt: new Date("2026-07-18T12:00:00.000Z") },
    ])?.dueAt).toEqual(new Date("2026-07-18T12:00:00.000Z"));
    expect(selectNextAction([])).toBeNull();
  });
});
