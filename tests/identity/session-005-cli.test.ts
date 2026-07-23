import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  bootstrapFirstPlatformAdmin,
  recoverPlatformAdminMfa,
} from "@/modules/identity/administration";

function run(script: string, args: string[], overrides: Record<string, string> = {}) {
  return spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", script, ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        IDENTITY_OPERATOR_DATABASE_URL:
          "postgresql://operator:operator-secret@db.example.test/identity_preview?sslmode=require",
        ...overrides,
      },
    },
  );
}

describe("SESSION-005 privileged operator CLI safety", () => {
  it("does not expose raw bootstrap or break-glass use cases from the public module", () => {
    const publicIndex = readFileSync("src/modules/identity/index.ts", "utf8");
    expect(publicIndex).not.toContain("bootstrapFirstPlatformAdmin");
    expect(publicIndex).not.toContain("recoverPlatformAdminMfa");
    expect(publicIndex).toContain("createIdentityAdministrationService");
  });

  it("enforces operator intent inside the privileged use cases", async () => {
    await expect(
      bootstrapFirstPlatformAdmin({} as never, {
        accountId: "00000000-0000-4000-8000-000000000001",
        confirmation: "bypassed",
      }),
    ).rejects.toThrow("bootstrap confirmation is required");
    await expect(
      recoverPlatformAdminMfa({} as never, {
        accountId: "00000000-0000-4000-8000-000000000001",
        incidentId: "INC-123",
        environment: "preview",
        confirmationEnvironment: "production",
        operatorEnvironment: "preview",
      }),
    ).rejects.toThrow("break-glass environment confirmation does not match");
  });

  it("bootstrap fails closed without the explicit confirmation flag", () => {
    const result = run("scripts/identity/admin-bootstrap.ts", [
      "--account=00000000-0000-4000-8000-000000000001",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("identity.admin_bootstrap.failed");
    expect(`${result.stdout}${result.stderr}`).not.toContain("operator-secret");
  });

  it("break-glass requires incident and exact environment confirmation", () => {
    const result = run(
      "scripts/identity/admin-recover-mfa.ts",
      [
        "--account=00000000-0000-4000-8000-000000000001",
        "--incident=INC-123",
        "--environment=preview",
      ],
      { IDENTITY_OPERATOR_ENVIRONMENT: "preview" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("identity.admin_recover_mfa.failed");
    expect(`${result.stdout}${result.stderr}`).not.toContain("operator-secret");
  });
});
