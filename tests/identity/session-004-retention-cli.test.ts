import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runExecute(overrides: Record<string, string | undefined>) {
  return spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/identity/run-retention.ts", "--execute"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        IDENTITY_MAINTENANCE_DATABASE_URL: "postgresql://operator:secret@db.example.test/identity_preview",
        ...overrides,
      },
    },
  );
}

describe("SESSION-004 retention operator safety", () => {
  it("rejects production before opening a database connection", () => {
    const result = runExecute({
      IDENTITY_RETENTION_ENVIRONMENT: "production",
      IDENTITY_RETENTION_TARGET_ACK: "anything",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("identity.retention.failed");
    expect(`${result.stdout}${result.stderr}`).not.toContain("operator:secret");
  }, 15_000);

  it("rejects an unbound remote provider identity and acknowledgement", () => {
    const result = runExecute({
      IDENTITY_RETENTION_ENVIRONMENT: "preview",
      IDENTITY_RETENTION_TARGET_ACK: "wrong-target",
      NEON_PROJECT_ID: "",
      NEON_BRANCH_ID: "",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("identity.retention.failed");
    expect(`${result.stdout}${result.stderr}`).not.toContain("wrong-target");
  }, 15_000);
});
