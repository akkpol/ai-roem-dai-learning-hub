import { describe, expect, it } from "vitest";
import {
  confirmCohort,
  evaluateCohort,
  reserveSeat,
  withdrawReservation,
} from "@/lib/domain/cohort";

const deadline = new Date("2026-07-20T12:00:00.000Z");

describe("evaluateCohort", () => {
  it("keeps a cohort collecting below its minimum before the deadline", () => {
    const result = evaluateCohort({
      status: "collecting",
      minimumEnrollment: 8,
      activeReservations: 7,
      registrationDeadlineAt: deadline,
      now: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(result.status).toBe("collecting");
    expect(result.remainingToThreshold).toBe(1);
    expect(result.thresholdReachedAt).toBeNull();
  });

  it("moves to threshold_met at exactly the minimum without confirming", () => {
    const reachedAt = new Date("2026-07-18T12:00:00.000Z");
    const result = evaluateCohort({
      status: "collecting",
      minimumEnrollment: 8,
      activeReservations: 8,
      registrationDeadlineAt: deadline,
      now: reachedAt,
    });

    expect(result.status).toBe("threshold_met");
    expect(result.remainingToThreshold).toBe(0);
    expect(result.thresholdReachedAt).toEqual(reachedAt);
  });

  it("postpones below-threshold cohorts at the deadline", () => {
    const result = evaluateCohort({
      status: "collecting",
      minimumEnrollment: 8,
      activeReservations: 4,
      registrationDeadlineAt: deadline,
      now: deadline,
    });

    expect(result.status).toBe("postponed");
    expect(result.postponedAt).toEqual(deadline);
  });

  it("never rolls a confirmed cohort back when reservations later drop", () => {
    const result = evaluateCohort({
      status: "confirmed",
      minimumEnrollment: 8,
      activeReservations: 2,
      registrationDeadlineAt: deadline,
      now: new Date("2026-07-21T12:00:00.000Z"),
    });

    expect(result.status).toBe("confirmed");
  });
});

describe("reserveSeat", () => {
  it("reserves the final available seat", () => {
    expect(
      reserveSeat({ status: "collecting", activeReservations: 49, maximumEnrollment: 50 }),
    ).toBe("reserved");
  });

  it("places later applicants on the waiting list when capacity is full", () => {
    expect(
      reserveSeat({ status: "threshold_met", activeReservations: 50, maximumEnrollment: 50 }),
    ).toBe("waitlisted");
  });

  it("rejects reservations after a cohort is confirmed", () => {
    expect(
      reserveSeat({ status: "confirmed", activeReservations: 8, maximumEnrollment: 50 }),
    ).toBe("closed");
  });
});

describe("confirmCohort", () => {
  it("converts active reservations once after threshold is met", () => {
    const result = confirmCohort({
      status: "threshold_met",
      activeReservations: 8,
      minimumEnrollment: 8,
    });

    expect(result).toEqual({
      status: "confirmed",
      changed: true,
      usedOverride: false,
      convertReservationCount: 8,
    });
  });

  it("requires a reason to confirm below threshold", () => {
    expect(() =>
      confirmCohort({
        status: "collecting",
        activeReservations: 4,
        minimumEnrollment: 8,
        overrideReason: "  ",
      }),
    ).toThrow("overrideReason");
  });

  it("is idempotent when already confirmed", () => {
    expect(
      confirmCohort({
        status: "confirmed",
        activeReservations: 8,
        minimumEnrollment: 8,
      }),
    ).toEqual({
      status: "confirmed",
      changed: false,
      usedOverride: false,
      convertReservationCount: 0,
    });
  });
});

describe("withdrawReservation", () => {
  it("returns threshold_met to collecting before confirmation", () => {
    expect(
      withdrawReservation({
        status: "threshold_met",
        activeReservationsBeforeWithdrawal: 8,
        minimumEnrollment: 8,
      }),
    ).toEqual({ status: "collecting", activeReservations: 7 });
  });

  it("keeps confirmed status after a withdrawal", () => {
    expect(
      withdrawReservation({
        status: "confirmed",
        activeReservationsBeforeWithdrawal: 8,
        minimumEnrollment: 8,
      }),
    ).toEqual({ status: "confirmed", activeReservations: 7 });
  });
});
