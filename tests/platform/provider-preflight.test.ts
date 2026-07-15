import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const migrationEnvironment = readFileSync(
  new URL("../../scripts/database/migration-env.ts", import.meta.url),
  "utf8",
);

describe("SESSION-002 provider preflight ordering", () => {
  it("runs the executable provider preflight before the first migration", () => {
    const preflight = workflow.indexOf(
      "tsx scripts/database/provider-preflight.ts",
    );
    const migration = workflow.indexOf("npm run db:migrate");

    expect(preflight).toBeGreaterThan(-1);
    expect(migration).toBeGreaterThan(preflight);
  });

  it("makes migration environment validation reuse the provider preflight", () => {
    expect(migrationEnvironment).toContain(
      'from "./provider-preflight"',
    );
    expect(migrationEnvironment).toContain(
      "preflightSession002DatabaseTarget(input)",
    );
  });
});
