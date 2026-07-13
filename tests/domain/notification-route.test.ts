import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { sendPendingNotifications } = vi.hoisted(() => ({
  sendPendingNotifications: vi.fn(),
}));

vi.mock("@/lib/email/outbox", () => ({ sendPendingNotifications }));

import { GET } from "@/app/api/cron/notifications/route";

const originalEnvironment = { ...process.env };

function authorizedRequest() {
  return new NextRequest("https://example.test/api/cron/notifications", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("notification cron route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendPendingNotifications.mockReset();
    process.env.CRON_SECRET = "test-cron-secret";
    delete process.env.GMAIL_SMTP_USER;
    delete process.env.GMAIL_SMTP_APP_PASSWORD;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("fails loudly when Gmail SMTP is not configured", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Email provider unavailable",
      code: "gmail_smtp_not_configured",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "notification_delivery_unavailable",
      expect.objectContaining({ code: "gmail_smtp_not_configured" }),
    );
    expect(sendPendingNotifications).not.toHaveBeenCalled();
  });

  it("returns a failing status when any claimed email fails", async () => {
    process.env.GMAIL_SMTP_USER = "system@example.test";
    process.env.GMAIL_SMTP_APP_PASSWORD = "app-password";
    process.env.EMAIL_FROM = "AI เริ่มได้ <system@example.test>";
    sendPendingNotifications.mockResolvedValue({ claimed: 2, sent: 1, failed: 1 });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "Notification delivery failed",
      claimed: 2,
      sent: 1,
      failed: 1,
    });
  });

  it("returns success only when the batch has no delivery failures", async () => {
    process.env.GMAIL_SMTP_USER = "system@example.test";
    process.env.GMAIL_SMTP_APP_PASSWORD = "app-password";
    process.env.EMAIL_FROM = "AI เริ่มได้ <system@example.test>";
    sendPendingNotifications.mockResolvedValue({ claimed: 1, sent: 1, failed: 0 });

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, sent: 1, failed: 0 });
  });
});
