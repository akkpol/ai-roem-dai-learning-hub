import { describe, expect, it } from "vitest";
import { nextRetryAt } from "@/lib/email/outbox-policy";
import { isValidCronAuthorization } from "@/lib/security/cron";

describe("nextRetryAt", () => {
  it("uses bounded exponential retry delays", () => {
    const now = new Date("2026-07-13T12:00:00.000Z");

    expect(nextRetryAt(now, 1)).toEqual(new Date("2026-07-13T12:10:00.000Z"));
    expect(nextRetryAt(now, 10)).toEqual(new Date("2026-07-13T18:00:00.000Z"));
  });
});

describe("isValidCronAuthorization", () => {
  it("accepts the exact bearer token", () => {
    expect(isValidCronAuthorization("Bearer secret-value", "secret-value")).toBe(true);
  });

  it("fails closed for missing or different values", () => {
    expect(isValidCronAuthorization(null, "secret-value")).toBe(false);
    expect(isValidCronAuthorization("Bearer other-value", "secret-value")).toBe(false);
    expect(isValidCronAuthorization("Bearer secret-value", undefined)).toBe(false);
  });
});
