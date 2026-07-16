import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("Neon-only database acceptance contract", () => {
  it("does not retain Docker runtime files or CI execution", () => {
    expect(existsSync(path.join(root, "compose.yaml"))).toBe(false);
    expect(existsSync(path.join(root, "infra", "postgres", "local-init.sql"))).toBe(false);

    const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).not.toMatch(/^\s+services:/m);
    expect(workflow).not.toMatch(/\bdocker\b/i);
  });

  it("binds the remote reset acknowledgement and both URLs to the approved test database", () => {
    const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

    expect(workflow).toContain('const expectedDatabase = "learning_hub_session_002_test";');
    expect(workflow).toContain('test "$REMOTE_TEST_DATABASE_RESET_ACK" = "$expected_database"');
    expect(workflow).toContain('process.env.DATABASE_URL');
    expect(workflow).toContain('process.env.MIGRATION_DATABASE_URL');
  });
});
