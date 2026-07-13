export type CohortStatus =
  | "draft"
  | "collecting"
  | "threshold_met"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "postponed"
  | "cancelled";

type EvaluationInput = {
  status: CohortStatus;
  minimumEnrollment: number;
  activeReservations: number;
  registrationDeadlineAt: Date;
  now: Date;
  thresholdReachedAt?: Date | null;
};

export type CohortEvaluation = {
  status: CohortStatus;
  remainingToThreshold: number;
  thresholdReachedAt: Date | null;
  postponedAt: Date | null;
};

export function getReservationWindowState(input: {
  registrationOpensAt: Date;
  registrationDeadlineAt: Date;
  now: Date;
}): "not_open" | "open" | "closed" {
  if (input.now.getTime() < input.registrationOpensAt.getTime()) return "not_open";
  if (input.now.getTime() >= input.registrationDeadlineAt.getTime()) return "closed";
  return "open";
}

const terminalOrCommittedStatuses: CohortStatus[] = [
  "confirmed",
  "in_progress",
  "completed",
  "postponed",
  "cancelled",
];

export function evaluateCohort(input: EvaluationInput): CohortEvaluation {
  const remainingToThreshold = Math.max(
    0,
    input.minimumEnrollment - input.activeReservations,
  );

  if (terminalOrCommittedStatuses.includes(input.status) || input.status === "draft") {
    return {
      status: input.status,
      remainingToThreshold,
      thresholdReachedAt: input.thresholdReachedAt ?? null,
      postponedAt: input.status === "postponed" ? input.now : null,
    };
  }

  if (
    input.status === "collecting" &&
    input.now.getTime() >= input.registrationDeadlineAt.getTime()
  ) {
    return {
      status: "postponed",
      remainingToThreshold,
      thresholdReachedAt: null,
      postponedAt: input.now,
    };
  }

  if (input.activeReservations >= input.minimumEnrollment) {
    return {
      status: "threshold_met",
      remainingToThreshold: 0,
      thresholdReachedAt: input.thresholdReachedAt ?? input.now,
      postponedAt: null,
    };
  }

  return {
    status: "collecting",
    remainingToThreshold,
    thresholdReachedAt: null,
    postponedAt: null,
  };
}

type ReservationInput = {
  status: CohortStatus;
  activeReservations: number;
  maximumEnrollment: number;
};

export function reserveSeat(input: ReservationInput): "reserved" | "waitlisted" | "closed" {
  if (input.status !== "collecting" && input.status !== "threshold_met") {
    return "closed";
  }

  return input.activeReservations < input.maximumEnrollment ? "reserved" : "waitlisted";
}

type ConfirmInput = {
  status: CohortStatus;
  activeReservations: number;
  minimumEnrollment: number;
  overrideReason?: string | null;
};

type ConfirmResult = {
  status: "confirmed";
  changed: boolean;
  usedOverride: boolean;
  convertReservationCount: number;
};

export function confirmCohort(input: ConfirmInput): ConfirmResult {
  if (input.status === "confirmed") {
    return {
      status: "confirmed",
      changed: false,
      usedOverride: false,
      convertReservationCount: 0,
    };
  }

  if (input.status !== "threshold_met" && input.status !== "collecting") {
    throw new Error(`Cohort cannot be confirmed from status ${input.status}`);
  }

  const usedOverride = input.activeReservations < input.minimumEnrollment;
  if (usedOverride && !input.overrideReason?.trim()) {
    throw new Error("overrideReason is required below the enrollment threshold");
  }

  return {
    status: "confirmed",
    changed: true,
    usedOverride,
    convertReservationCount: input.activeReservations,
  };
}

type WithdrawalInput = {
  status: CohortStatus;
  activeReservationsBeforeWithdrawal: number;
  minimumEnrollment: number;
};

export function withdrawReservation(input: WithdrawalInput) {
  const activeReservations = Math.max(0, input.activeReservationsBeforeWithdrawal - 1);
  const canRollBack = input.status === "threshold_met";

  return {
    status:
      canRollBack && activeReservations < input.minimumEnrollment
        ? ("collecting" as const)
        : input.status,
    activeReservations,
  };
}
