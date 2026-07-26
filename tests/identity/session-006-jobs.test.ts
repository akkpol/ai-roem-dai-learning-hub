import { describe, expect, it } from "vitest";

import {
  authorizeCronRequest,
  createIdentityJobHandlers,
  readCronSecret,
} from "@/modules/identity/jobs";

describe("SESSION-006 scheduler boundary", () => {
  it("requires a bounded production secret", () => {
    expect(() => readCronSecret({ CRON_SECRET: "too-short" })).toThrow(
      "cron configuration is invalid",
    );
    expect(readCronSecret({ CRON_SECRET: "a".repeat(32) })).toBe("a".repeat(32));
  });

  it("accepts only GET with the exact bearer secret and no caller-selected account", () => {
    const secret = "s".repeat(32);
    expect(
      authorizeCronRequest(
        new Request("https://example.test/api/jobs/identity/email-delivery", {
          headers: { authorization: `Bearer ${secret}` },
        }),
        secret,
      ),
    ).toEqual({ allowed: true });
    expect(
      authorizeCronRequest(
        new Request("https://example.test/api/jobs/identity/email-delivery", {
          method: "POST",
          headers: { authorization: `Bearer ${secret}` },
        }),
        secret,
      ),
    ).toEqual({ allowed: false, status: 405 });
    expect(
      authorizeCronRequest(
        new Request(
          "https://example.test/api/jobs/identity/email-delivery?accountId=target",
          { headers: { authorization: `Bearer ${secret}` } },
        ),
        secret,
      ),
    ).toEqual({ allowed: false, status: 400 });
    expect(
      authorizeCronRequest(
        new Request("https://example.test/api/jobs/identity/email-delivery", {
          headers: { authorization: "Bearer wrong" },
        }),
        secret,
      ),
    ).toEqual({ allowed: false, status: 401 });
  });

  it("turns an unhealthy email backlog into a scheduler-visible failure", async () => {
    const secret = "s".repeat(32);
    const handlers = createIdentityJobHandlers({
      cronSecret: secret,
      dispatchEmail: async () => ({
        requiresAttention: 1,
        oldestPendingAgeMs: 960_000,
        deadLetterCount: 0,
      }),
      runRetention: async () => ({}),
    });
    const response = await handlers.dispatchEmail(
      new Request("https://example.test/api/jobs/identity/email-delivery", {
        headers: {
          authorization: `Bearer ${secret}`,
          "x-correlation-id": "email-job-test-1",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("x-correlation-id")).toBe("email-job-test-1");
    await expect(response.json()).resolves.toMatchObject({
      error: "job_requires_attention",
    });
  });
});
