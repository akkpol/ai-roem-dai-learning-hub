import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) =>
  readFileSync(path.join(root, file), "utf8").replaceAll("\\", "/");

describe("SESSION-006 production contract", () => {
  it("adds immutable delivery ledger and lease-aware email outbox migration", () => {
    const migration = source("drizzle/0004_identity_operations.sql");
    expect(migration).toContain("identity_email_deliveries");
    expect(migration).toContain("lease_token");
    expect(migration).toContain("lease_expires_at");
    expect(migration).toContain("provider_created_at");
    expect(migration).toContain("UNIQUE");
  });

  it("keeps app, email worker, and maintenance privileges distinct", () => {
    const migration = source("drizzle/0004_identity_operations.sql");
    expect(migration).toContain("learning_hub_identity_email_worker");
    expect(migration).toMatch(
      /REVOKE UPDATE ON TABLE identity_email_outbox FROM learning_hub_app/i,
    );
    expect(migration).toMatch(
      /GRANT SELECT, UPDATE ON TABLE identity_email_outbox TO learning_hub_identity_email_worker/i,
    );
    expect(migration).not.toMatch(
      /GRANT (?:SELECT, )?UPDATE ON TABLE identity_audit_events TO learning_hub_identity_email_worker/i,
    );
  });

  it("uses a free external scheduler without a Vercel Cron plan dependency", () => {
    const vercel = JSON.parse(source("vercel.json")) as {
      crons?: Array<unknown>;
    };
    expect(vercel.crons).toBeUndefined();

    const scheduler = source(".github/workflows/identity-jobs.yml");
    expect(scheduler).toContain('cron: "2/5 * * * *"');
    expect(scheduler).toContain('cron: "17 2 * * *"');
    expect(scheduler).toContain("vars.IDENTITY_JOBS_BASE_URL");
    expect(scheduler).toContain("secrets.CRON_SECRET");
    expect(scheduler).toContain("github.event_name == 'workflow_dispatch'");
    expect(scheduler).toContain(
      "identity-jobs-production-email-delivery",
    );
    expect(scheduler).toContain("identity-jobs-production-retention");
    expect(scheduler).not.toContain("group: identity-jobs-production\n");
    expect(scheduler).toContain("/api/jobs/identity/email-delivery");
    expect(scheduler).toContain("/api/jobs/identity/retention");
    expect(scheduler).not.toContain("?account");
  });

  it("exposes only POST for the signed webhook and only GET for jobs", () => {
    const webhook = source("src/app/api/webhooks/resend/route.ts");
    const emailJob = source(
      "src/app/api/jobs/identity/email-delivery/route.ts",
    );
    expect(webhook).toMatch(/export function POST/);
    expect(webhook).not.toMatch(/export function GET/);
    expect(emailJob).toMatch(/export function GET/);
    expect(emailJob).not.toMatch(/export function POST/);
  });

  it("runs provider readiness with the complete operations contract", () => {
    const workflow = source(".github/workflows/ci.yml");
    for (const variable of [
      "IDENTITY_EMAIL_WORKER_DATABASE_URL",
      "IDENTITY_MAINTENANCE_DATABASE_URL",
      "RESEND_API_KEY",
      "RESEND_WEBHOOK_SECRET",
      "CRON_SECRET",
    ]) {
      expect(workflow).toContain(`${variable}:`);
    }
    expect(workflow).toContain('"identityOperations":"ready"');
    const cronSecret = workflow.match(/CRON_SECRET:\s+([^\r\n]+)/)?.[1];
    expect(cronSecret?.trim().length).toBeGreaterThanOrEqual(32);
  });
});
