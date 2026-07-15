import { describe, expect, it } from "vitest";
import { readLearningStudioFlags } from "@/lib/feature-flags";

describe("Learning Studio feature flags", () => {
  it("fails closed in production unless each feature is explicitly enabled", () => {
    expect(readLearningStudioFlags({ NODE_ENV: "production" })).toEqual({
      workspaces: false,
      authoring: false,
      payments: false,
      community: false,
    });
    expect(readLearningStudioFlags({ NODE_ENV: "production", FEATURE_LEARNING_WORKSPACES: "true" }).workspaces).toBe(true);
  });

  it("keeps local development usable while honoring explicit false", () => {
    expect(readLearningStudioFlags({ NODE_ENV: "development" }).payments).toBe(true);
    expect(readLearningStudioFlags({ NODE_ENV: "development", FEATURE_LEARNING_PAYMENTS: "false" }).payments).toBe(false);
  });
});
