import { describe, expect, it, vi } from "vitest";

import { createResendAuthEmailSender } from "@/modules/identity/email/resend-adapter";

describe("Resend authentication email adapter", () => {
  it("maps a fixed template and uses the outbox UUID as idempotency key", async () => {
    const send = vi.fn(async () => ({
      data: { id: "provider-message-1" },
      error: null,
    }));
    const sender = createResendAuthEmailSender(
      { emails: { send } },
      "Learning Hub <auth@learn.example.test>",
    );

    await expect(
      sender.send({
        template: "verify_email",
        recipient: "user@example.test",
        actionUrl: "https://learning.example.test/verify-email?token=safe",
        idempotencyKey: "d45e2cc8-d96d-4555-a11d-d3f3780aa21d",
      }),
    ).resolves.toEqual({ providerMessageId: "provider-message-1" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Learning Hub <auth@learn.example.test>",
        to: ["user@example.test"],
        subject: "ยืนยันอีเมล Learning Hub",
      }),
      { idempotencyKey: "d45e2cc8-d96d-4555-a11d-d3f3780aa21d" },
    );
  });

  it("normalizes provider failures without returning provider secrets", async () => {
    const send = vi.fn(async () => ({
      data: null,
      error: { name: "restricted_api_key", message: "secret-provider-detail" },
    }));
    const sender = createResendAuthEmailSender(
      { emails: { send } },
      "Learning Hub <auth@learn.example.test>",
    );
    await expect(
      sender.send({
        template: "reset_password",
        recipient: "user@example.test",
        actionUrl: "https://learning.example.test/reset-password?token=safe",
        idempotencyKey: "d45e2cc8-d96d-4555-a11d-d3f3780aa21d",
      }),
    ).rejects.toThrow("authentication email provider rejected request");
  });
});
