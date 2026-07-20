import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("SESSION-004 production topology", () => {
  it("uses documented Better Auth APIs and disables trusted-device bypass", () => {
    const auth = read("src/modules/identity/auth.ts");
    const security = read("src/modules/identity/account-security.ts");
    expect(auth).toContain('from "better-auth/plugins"');
    expect(auth).toContain("twoFactor({");
    expect(auth).toContain("freshAge: 10 * 60");
    expect(security).toContain("auth.api.changePassword");
    expect(security).toContain("auth.api.listSessions");
    expect(security).toContain("auth.api.verifyTOTP");
    expect(security).toContain("auth.api.verifyBackupCode");
    expect(security).not.toContain("trustDevice: true");
  });

  it("keeps hard delete disabled and uses transactional deletion events", () => {
    const auth = read("src/modules/identity/auth.ts");
    const privacy = read("src/modules/identity/privacy.ts");
    expect(auth).toContain("deleteUser: { enabled: false }");
    expect(privacy).toContain('eventType: "identity.account_deletion_scheduled.v1"');
    expect(privacy).toContain('eventType: "identity.account_closed.v1"');
    expect(privacy).toContain("hashDeletionToken");
    expect(privacy).not.toContain("auth.api.deleteUser");
  });

  it("exposes only explicit account and 2FA routes", () => {
    const expected = [
      "src/app/api/account/profile/route.ts",
      "src/app/api/account/sessions/route.ts",
      "src/app/api/account/password/route.ts",
      "src/app/api/account/two-factor/enroll/route.ts",
      "src/app/api/account/privacy/export/route.ts",
      "src/app/api/account/privacy/deletion/request/route.ts",
      "src/app/api/account/privacy/deletion/confirm/route.ts",
      "src/app/api/account/privacy/deletion/cancel/route.ts",
      "src/app/api/auth/two-factor/route.ts",
    ];
    for (const route of expected) expect(read(route)).toContain("getAccountHttpHandlers");
  });

  it("keeps deletion confirmation GET read-only and requires a deliberate POST", () => {
    const route = read("src/app/api/account/privacy/deletion/confirm/route.ts");
    expect(route).toContain("export function GET");
    expect(route).toContain("renderDeletionConfirmation");
    expect(route).toContain("export function POST");
    expect(route).toContain("confirmDeletion(request)");
    expect(route.indexOf("renderDeletionConfirmation")).toBeLessThan(
      route.indexOf("confirmDeletion(request)"),
    );
  });

  it("makes retention execution opt-in and provider-bound", () => {
    const cli = read("scripts/identity/run-retention.ts");
    expect(cli).toContain('argv.includes("--execute")');
    expect(cli).toContain("dryRun: !execute");
    expect(cli).toContain("assertSafeRetentionExecution");
    expect(cli).toContain("IDENTITY_RETENTION_TARGET_ACK");
    expect(cli).toContain("IDENTITY_RETENTION_ENVIRONMENT");
  });

  it("bounds history retention and removes 90-day email metadata", () => {
    const privacy = read("src/modules/identity/privacy.ts");
    expect(privacy).toContain("stalePolicyAcceptances");
    expect(privacy).toContain("staleAuditEvents");
    expect(privacy).toContain("staleEmailMetadata");
    expect(privacy).toContain("cutoffs.delivery");
    expect(privacy).toContain(".limit(options.batchLimit)");
  });
});
