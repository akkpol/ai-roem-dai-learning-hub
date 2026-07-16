import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proof = readFileSync(
  "tests/integration/identity/session-003-compatibility.integration.test.ts",
  "utf8",
);

describe("SESSION-003 release proof topology", () => {
  it("exercises production orchestration and the generated migration", () => {
    expect(proof).toContain("createIdentityService");
    expect(proof).toContain("createAuthHttpHandlers");
    expect(proof).toContain("runMigrations");
    expect(proof).toContain("identityAccounts");
    expect(proof).not.toContain("createSession003Spike");
  });

  it("covers the binding D-011 and D-013 production scenarios", () => {
    for (const scenario of [
      "signup rollback",
      "sequential reset",
      "concurrent reset",
      "rollback after invalidation",
      "rollback after outbox",
      "namespace and account isolation",
      "unknown email",
      "route non-bypass",
      "production rate limit",
    ]) {
      expect(proof).toContain(scenario);
    }
  });
});
