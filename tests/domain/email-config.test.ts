import { describe, expect, it } from "vitest";
import { hasGmailConfiguration } from "@/lib/email/gmail";

describe("Gmail provider configuration", () => {
  it("requires the dedicated SMTP user, app password, and sender", () => {
    expect(hasGmailConfiguration({})).toBe(false);
    expect(
      hasGmailConfiguration({
        GMAIL_SMTP_USER: "system@example.com",
        GMAIL_SMTP_APP_PASSWORD: "app-password",
      }),
    ).toBe(false);
    expect(
      hasGmailConfiguration({
        GMAIL_SMTP_USER: "system@example.com",
        GMAIL_SMTP_APP_PASSWORD: "app-password",
        EMAIL_FROM: "AI เริ่มได้ <system@example.com>",
      }),
    ).toBe(true);
  });
});
