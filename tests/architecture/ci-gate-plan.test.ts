import { describe, expect, it } from "vitest";

import { planGates } from "../../scripts/ci/plan-gates.mjs";

describe("CI gate planning", () => {
  it("keeps markdown-only changes on the fast documentation lane", () => {
    expect(
      planGates([
        "README.md",
        "docs/project/LEAN_DELIVERY_PLAYBOOK.md",
        "docs/project/OLD_STATUS.md",
      ]),
    ).toEqual({ code: false, provider: false });
  });

  it("runs code gates without provider gates for an isolated UI change", () => {
    expect(planGates(["src/app/page.tsx", "src/app/globals.css"])).toEqual({
      code: true,
      provider: false,
    });
  });

  it.each([
    "drizzle/0001_identity_authentication.sql",
    "src/platform/database/client.ts",
    "src/modules/identity/service.ts",
    "tests/integration/database/migrations.integration.test.ts",
    ".github/workflows/ci.yml",
    "package-lock.json",
  ])("runs provider gates for provider-sensitive path %s", (file) => {
    expect(planGates([file])).toEqual({ code: true, provider: true });
  });

  it("normalizes Windows paths before classification", () => {
    expect(planGates(["src\\platform\\events\\outbox.ts"])).toEqual({
      code: true,
      provider: true,
    });
  });
});
