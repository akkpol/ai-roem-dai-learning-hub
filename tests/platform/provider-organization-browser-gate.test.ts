import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("provider organization browser gate", () => {
  it("requires provider preflight, an explicit acknowledgement, manifest-bound cleanup, and isolated port", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const fixture = readFileSync("scripts/e2e/organization-provider-fixture.ts", "utf8");
    const e2e = readFileSync("tests/e2e/organization-workspace.spec.ts", "utf8");
    expect(workflow).toContain("Provider authenticated organization browser gate");
    expect(workflow).toContain("ORGANIZATION_E2E_FIXTURE_ACK");
    expect(workflow).toContain("scripts/database/provider-preflight.ts");
    expect(workflow).toContain("--port 3002");
    expect(workflow).toContain("organization-provider-fixture.ts cleanup");
    expect(workflow).toContain("provider-organization-browser-evidence");
    expect(fixture).toContain("preflightSession002DatabaseTarget(process.env)");
    expect(fixture).toContain("ORGANIZATION_E2E_FIXTURE_ACK");
    expect(fixture).toContain("E2E_FIXTURE_MANIFEST_PATH");
    expect(fixture).toContain("delete from identity_accounts where id = $1");
    expect(fixture).not.toContain("delete from identity_accounts where email like");
    expect(e2e).toContain("ORGANIZATION_E2E_SUCCESS_ARTIFACT_DIR");
    expect(e2e).toContain("recordFixtureOrganization");
    expect(e2e).not.toContain("allowRealMutations || testInfo.project.name.includes(\"mobile\")");
    expect(workflow).toContain("timeout-minutes: 25");
    expect(workflow).toContain("timeout-minutes: 8");
    expect(workflow).toContain("timeout-minutes: 5");
    expect(workflow).toContain("--workers=1");
    expect(workflow).toContain("ORGANIZATION_E2E_PROVIDER_GATE: '1'");
    expect(workflow).toContain("ORGANIZATION_E2E_BASE_URL: http://localhost:3002");
    expect(workflow).toContain("AUTH_BASE_URL: http://localhost:3002/api/auth");
    expect(workflow).not.toContain("organization-provider-fixture.ts cleanup || true");
    expect(workflow).not.toContain("test-results/playwright");
    expect(fixture).toContain("atomicWrite(manifestPath, manifest); // pending cleanup authority exists before signUp");
    expect(fixture).toContain("REMOTE_TEST_NEON_IDENTITY_ACK");
    expect(fixture).toContain("identityAcknowledgement(providerIdentity) !== identityAcknowledgement(manifest.providerIdentity)");
    expect(fixture).not.toContain("select organization_id from organization_memberships where account_id");
    expect(fixture).toContain("organization.created.v1");
    expect(fixture).toContain("rmSync(manifestPath); // only after committed and verified deletion");
  });

  it("keeps storage-state conversion local and does not log tokens or cookies", () => {
    const fixture = readFileSync("scripts/e2e/organization-provider-fixture.ts", "utf8");
    expect(fixture).toContain("function toStorageState");
    expect(fixture).toContain("getSetCookie");
    expect(fixture).not.toMatch(/console\.(?:log|info).*cookie/i);
    expect(fixture).not.toMatch(/console\.(?:log|info).*token/i);
    const config = readFileSync("playwright.config.ts", "utf8");
    expect(config).toContain('providerBrowserGate ? "off"');
  });
});
