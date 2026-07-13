export type CompletionPolicy = "automatic" | "admin_approval";
export type CompletionStatus = "in_progress" | "pending_approval" | "completed";

type CompletionInput = {
  policy: CompletionPolicy;
  requiredLessonsCompleted: number;
  totalRequiredLessons: number;
  attendancePercent: number;
  assignmentPassPercent: number;
  adminApproved?: boolean;
};

export type CompletionEvaluation = {
  status: CompletionStatus;
  lessonCompletionPercent: number;
  qualified: boolean;
};

function boundedPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function evaluateCompletion(input: CompletionInput): CompletionEvaluation {
  const lessonCompletionPercent =
    input.totalRequiredLessons === 0
      ? 100
      : boundedPercent(
          Math.round((input.requiredLessonsCompleted / input.totalRequiredLessons) * 100),
        );
  const qualified =
    lessonCompletionPercent === 100 &&
    boundedPercent(input.attendancePercent) >= 80 &&
    boundedPercent(input.assignmentPassPercent) >= 70;

  if (!qualified) {
    return { status: "in_progress", lessonCompletionPercent, qualified: false };
  }

  if (input.policy === "admin_approval" && !input.adminApproved) {
    return { status: "pending_approval", lessonCompletionPercent, qualified: true };
  }

  return { status: "completed", lessonCompletionPercent, qualified: true };
}
