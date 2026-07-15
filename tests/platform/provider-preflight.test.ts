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
const environmentExample = readFileSync(
  new URL("../../.env.example", import.meta.url),
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
      "await preflightSession002DatabaseTarget(input, providerFetch)",
    );
  });

  it("supplies only the Neon API key as provider authority in CI", () => {
    expect(workflow).toContain(
      "NEON_API_KEY: ${{ secrets.NEON_API_KEY }}",
    );
    expect(workflow).not.toContain("SESSION_002_APPROVED_");
    expect(environmentExample).toContain("NEON_API_KEY=");
    expect(environmentExample).not.toContain("SESSION_002_APPROVED_");
  });
});
