export type LearningStudioFlags = {
  workspaces: boolean;
  authoring: boolean;
  payments: boolean;
  community: boolean;
};

function flag(value: string | undefined, defaultValue: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

export function readLearningStudioFlags(
  env: Partial<Record<string, string | undefined>> = process.env,
): LearningStudioFlags {
  const localDefault = env.NODE_ENV !== "production";
  return {
    workspaces: flag(env.FEATURE_LEARNING_WORKSPACES, localDefault),
    authoring: flag(env.FEATURE_LEARNING_AUTHORING, localDefault),
    payments: flag(env.FEATURE_LEARNING_PAYMENTS, localDefault),
    community: flag(env.FEATURE_LEARNING_COMMUNITY, localDefault),
  };
}

export const learningStudioFlags = readLearningStudioFlags();
