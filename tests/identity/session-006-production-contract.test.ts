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

  it("declares two Vercel GET cron schedules without account parameters", () => {
    const scheduler = JSON.parse(source("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(scheduler.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/api/jobs/identity/email-delivery",
        }),
        expect.objectContaining({ path: "/api/jobs/identity/retention" }),
      ]),
    );
    expect(scheduler.crons.every(({ path: value }) => !value.includes("?"))).toBe(
      true,
    );
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
});
