type CohortMetricInput = {
  registrationOpensAt: Date;
  registrationDeadlineAt: Date;
  thresholdReachedAt: Date | null;
  confirmed: boolean;
  cancelledAfterConfirmation: boolean;
  confirmedBelowThreshold: boolean;
};

export type BetaScorecardInput = {
  cohorts: CohortMetricInput[];
  invitations: number;
  acceptedInvitations: number;
  reservations: number;
  withdrawnReservations: number;
  waitlistedReservations: number;
  promotedWaitlistReservations: number;
  enrollments: number;
  qualifiedCompletions: number;
  otpOrEmailFailures: number;
  unauthorizedAccessAttempts: number;
  protectedAccessFailures: number;
  certificateGenerationFailures: number;
};

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100
    : Math.round(sorted[middle] * 100) / 100;
}

export function calculateBetaScorecard(input: BetaScorecardInput) {
  const cohortsReachedBeforeDeadline = input.cohorts.filter(
    (cohort) =>
      cohort.thresholdReachedAt &&
      cohort.thresholdReachedAt.getTime() <= cohort.registrationDeadlineAt.getTime(),
  );
  const daysToThreshold = cohortsReachedBeforeDeadline.map(
    (cohort) =>
      (cohort.thresholdReachedAt!.getTime() - cohort.registrationOpensAt.getTime()) /
      86_400_000,
  );
  const confirmedCohorts = input.cohorts.filter((cohort) => cohort.confirmed);

  return {
    thresholdAttainmentRate: rate(cohortsReachedBeforeDeadline.length, input.cohorts.length),
    medianDaysToThreshold: median(daysToThreshold),
    qualifiedCompletionRate: rate(input.qualifiedCompletions, input.enrollments),
    inviteAcceptanceRate: rate(input.acceptedInvitations, input.invitations),
    reservationConversionRate: rate(input.reservations, input.acceptedInvitations),
    withdrawalRate: rate(input.withdrawnReservations, input.reservations),
    waitlistConversionRate: rate(
      input.promotedWaitlistReservations,
      input.waitlistedReservations,
    ),
    confirmedCohortCancellationRate: rate(
      confirmedCohorts.filter((cohort) => cohort.cancelledAfterConfirmation).length,
      confirmedCohorts.length,
    ),
    belowThresholdConfirmations: input.cohorts.filter(
      (cohort) => cohort.confirmedBelowThreshold,
    ).length,
    otpOrEmailFailures: input.otpOrEmailFailures,
    unauthorizedAccessAttempts: input.unauthorizedAccessAttempts,
    protectedAccessFailures: input.protectedAccessFailures,
    certificateGenerationFailures: input.certificateGenerationFailures,
    readyForTargets: input.cohorts.length >= 2 || input.invitations >= 100,
  };
}
