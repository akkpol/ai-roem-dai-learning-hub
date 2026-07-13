import { describe, expect, it } from "vitest";
import { calculateBetaScorecard } from "@/lib/analytics/kpis";

describe("calculateBetaScorecard", () => {
  it("calculates outcome, driver, and guardrail rates with stable denominators", () => {
    const result = calculateBetaScorecard({
      cohorts: [
        {
          registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
          registrationDeadlineAt: new Date("2026-07-20T00:00:00.000Z"),
          thresholdReachedAt: new Date("2026-07-05T12:00:00.000Z"),
          confirmed: true,
          cancelledAfterConfirmation: false,
          confirmedBelowThreshold: false,
        },
        {
          registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
          registrationDeadlineAt: new Date("2026-07-20T00:00:00.000Z"),
          thresholdReachedAt: null,
          confirmed: false,
          cancelledAfterConfirmation: false,
          confirmedBelowThreshold: false,
        },
      ],
      invitations: 100,
      acceptedInvitations: 60,
      reservations: 50,
      withdrawnReservations: 5,
      waitlistedReservations: 10,
      promotedWaitlistReservations: 4,
      enrollments: 40,
      qualifiedCompletions: 30,
      otpOrEmailFailures: 2,
      unauthorizedAccessAttempts: 1,
      protectedAccessFailures: 0,
      certificateGenerationFailures: 1,
    });

    expect(result.thresholdAttainmentRate).toBe(50);
    expect(result.medianDaysToThreshold).toBe(4.5);
    expect(result.qualifiedCompletionRate).toBe(75);
    expect(result.inviteAcceptanceRate).toBe(60);
    expect(result.reservationConversionRate).toBeCloseTo(83.33, 2);
    expect(result.waitlistConversionRate).toBe(40);
    expect(result.readyForTargets).toBe(true);
  });

  it("returns null for rates without a denominator and defers targets", () => {
    const result = calculateBetaScorecard({
      cohorts: [],
      invitations: 0,
      acceptedInvitations: 0,
      reservations: 0,
      withdrawnReservations: 0,
      waitlistedReservations: 0,
      promotedWaitlistReservations: 0,
      enrollments: 0,
      qualifiedCompletions: 0,
      otpOrEmailFailures: 0,
      unauthorizedAccessAttempts: 0,
      protectedAccessFailures: 0,
      certificateGenerationFailures: 0,
    });

    expect(result.thresholdAttainmentRate).toBeNull();
    expect(result.qualifiedCompletionRate).toBeNull();
    expect(result.readyForTargets).toBe(false);
  });
});
