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

export function summarizeCompletionEvidence(input: {
  requiredLessonProgress: number[];
  attendancePercents: number[];
  requiredAssignments: Array<{ score: number | null; passingScore: number }>;
}) {
  const requiredLessonsCompleted = input.requiredLessonProgress.filter(
    (progress) => boundedPercent(progress) === 100,
  ).length;
  const attendancePercent =
    input.attendancePercents.length === 0
      ? 100
      : Math.round(
          input.attendancePercents.reduce((sum, value) => sum + boundedPercent(value), 0) /
            input.attendancePercents.length,
        );
  const assignmentPassPercent =
    input.requiredAssignments.length === 0
      ? 100
      : Math.round(
          (input.requiredAssignments.filter(
            (assignment) =>
              assignment.score !== null &&
              boundedPercent(assignment.score) >= boundedPercent(assignment.passingScore),
          ).length /
            input.requiredAssignments.length) *
            100,
        );

  return {
    requiredLessonsCompleted,
    totalRequiredLessons: input.requiredLessonProgress.length,
    attendancePercent,
    assignmentPassPercent,
  };
}

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
