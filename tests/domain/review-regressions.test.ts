import { describe, expect, it } from "vitest";
import {
  evaluateCohort,
  getReservationWindowState,
} from "@/lib/domain/cohort";
import { summarizeCompletionEvidence } from "@/lib/domain/completion";
import { assertInviteCapacity } from "@/lib/domain/invitations";
import {
  isNotificationClaimable,
  type OutboxClaimCandidate,
} from "@/lib/email/outbox-policy";
import { canUseDemoData } from "@/lib/data/demo-policy";

const opensAt = new Date("2026-07-01T00:00:00.000Z");
const deadline = new Date("2026-07-20T00:00:00.000Z");

describe("reservation window regressions", () => {
  it("rejects reservations before registration opens and at the deadline", () => {
    expect(
      getReservationWindowState({
        registrationOpensAt: opensAt,
        registrationDeadlineAt: deadline,
        now: new Date("2026-06-30T23:59:59.999Z"),
      }),
    ).toBe("not_open");
    expect(
      getReservationWindowState({
        registrationOpensAt: opensAt,
        registrationDeadlineAt: deadline,
        now: deadline,
      }),
    ).toBe("closed");
  });

  it("postpones a stale collecting cohort at the deadline even if its count is high", () => {
    expect(
      evaluateCohort({
        status: "collecting",
        minimumEnrollment: 8,
        activeReservations: 8,
        registrationDeadlineAt: deadline,
        now: deadline,
      }).status,
    ).toBe("postponed");
  });
});

describe("fallback invitation capacity", () => {
  it("rejects a fallback invite that would exceed the per-cohort limit", () => {
    expect(() => assertInviteCapacity(50, 1)).toThrow("50");
    expect(() => assertInviteCapacity(49, 1)).not.toThrow();
  });
});

describe("outbox claim recovery", () => {
  const base: OutboxClaimCandidate = {
    status: "processing",
    attempts: 1,
    scheduledAt: new Date("2026-07-13T10:00:00.000Z"),
    lockedAt: new Date("2026-07-13T10:00:00.000Z"),
  };

  it("reclaims stale processing notifications but not active claims", () => {
    expect(
      isNotificationClaimable(base, new Date("2026-07-13T10:11:00.000Z")),
    ).toBe(true);
    expect(
      isNotificationClaimable(base, new Date("2026-07-13T10:09:00.000Z")),
    ).toBe(false);
  });
});

describe("production demo isolation", () => {
  it("never exposes demo member data in production", () => {
    expect(canUseDemoData({ nodeEnv: "production", demoRequested: true })).toBe(false);
    expect(canUseDemoData({ nodeEnv: "development", demoRequested: true })).toBe(true);
  });
});

describe("completion evidence", () => {
  it("derives lesson, attendance, and assignment metrics from enrollment evidence", () => {
    expect(
      summarizeCompletionEvidence({
        requiredLessonProgress: [100, 100, 40],
        attendancePercents: [100, 80],
        requiredAssignments: [
          { score: 80, passingScore: 70 },
          { score: 60, passingScore: 70 },
        ],
      }),
    ).toEqual({
      requiredLessonsCompleted: 2,
      totalRequiredLessons: 3,
      attendancePercent: 90,
      assignmentPassPercent: 50,
    });
  });

  it("treats courses with no live sessions or assignments as fully satisfied", () => {
    expect(
      summarizeCompletionEvidence({
        requiredLessonProgress: [],
        attendancePercents: [],
        requiredAssignments: [],
      }),
    ).toEqual({
      requiredLessonsCompleted: 0,
      totalRequiredLessons: 0,
      attendancePercent: 100,
      assignmentPassPercent: 100,
    });
  });
});
