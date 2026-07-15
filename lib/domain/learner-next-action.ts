export type LearnerActionKind =
  | "payment"
  | "onboarding"
  | "session"
  | "assignment"
  | "feedback"
  | "certificate";

export type LearnerActionCandidate = {
  kind: LearnerActionKind;
  dueAt: Date | null;
};

const priority: Record<LearnerActionKind, number> = {
  payment: 0,
  onboarding: 1,
  session: 2,
  assignment: 3,
  feedback: 4,
  certificate: 5,
};

export function selectNextAction<T extends LearnerActionCandidate>(candidates: readonly T[]) {
  if (!candidates.length) return null;
  return [...candidates].sort((left, right) => {
    const priorityDifference = priority[left.kind] - priority[right.kind];
    if (priorityDifference !== 0) return priorityDifference;
    return (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
  })[0];
}
