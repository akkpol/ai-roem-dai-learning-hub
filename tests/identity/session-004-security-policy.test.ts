import { describe, expect, it } from "vitest";

import {
  assertFreshSession,
  toDeviceSessionDto,
} from "@/modules/identity/account-security";
import {
  hashDeletionToken,
  retentionCutoffs,
} from "@/modules/identity/privacy";

describe("SESSION-004 security policy", () => {
  it("requires a session created within ten minutes", () => {
    const now = new Date("2026-07-19T12:10:00.000Z");
    expect(() =>
      assertFreshSession(new Date("2026-07-19T12:00:00.000Z"), now),
    ).not.toThrow();
    expect(() =>
      assertFreshSession(new Date("2026-07-19T11:59:59.999Z"), now),
    ).toThrow("fresh session required");
  });

  it("returns an opaque device DTO without a raw session token", () => {
    const dto = toDeviceSessionDto(
      {
        id: "session-id",
        token: "raw-secret-token",
        createdAt: new Date("2026-07-19T00:00:00.000Z"),
        updatedAt: new Date("2026-07-19T00:01:00.000Z"),
        expiresAt: new Date("2026-07-26T00:00:00.000Z"),
        ipAddress: "203.0.113.9",
        userAgent: "Test Browser",
      },
      "session-id",
    );
    expect(dto).toEqual({
      id: "session-id",
      current: true,
      createdAt: "2026-07-19T00:00:00.000Z",
      lastSeenAt: "2026-07-19T00:01:00.000Z",
      expiresAt: "2026-07-26T00:00:00.000Z",
      ipAddress: "203.0.113.9",
      userAgent: "Test Browser",
    });
    expect(JSON.stringify(dto)).not.toContain("raw-secret-token");
  });

  it("stores only an HMAC deletion token hash", () => {
    const hash = hashDeletionToken("raw-deletion-token", "s".repeat(32));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("raw-deletion-token");
    expect(hashDeletionToken("raw-deletion-token", "s".repeat(32))).toBe(hash);
  });

  it("computes exact retention policy cutoffs", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    expect(retentionCutoffs(now)).toEqual({
      transient: new Date("2026-07-18T12:00:00.000Z"),
      delivery: new Date("2026-04-20T12:00:00.000Z"),
      identityHistory: new Date("2024-07-19T12:00:00.000Z"),
    });
  });
});
