import { describe, expect, it, vi } from "vitest";

import {
  createResendWebhookHandler,
  type ResendDeliveryLedger,
  type ResendWebhookVerifier,
} from "@/modules/identity/email/webhook";

const signedHeaders = {
  "svix-id": "evt_123",
  "svix-timestamp": "1784851200",
  "svix-signature": "v1,signature",
  "content-type": "application/json",
};

function ledger(): ResendDeliveryLedger {
  return {
    record: vi.fn(async () => ({ duplicate: false })),
  };
}

describe("SESSION-006 Resend delivery webhook", () => {
  it("verifies the exact raw body once and records provider time for ordering", async () => {
    const raw = '{ "type":"email.delivered","data":{"email_id":"msg_1"} }';
    const verifier: ResendWebhookVerifier = {
      verify: vi.fn(() => ({
        type: "email.delivered",
        createdAt: "2026-07-24T00:00:03.000Z",
        data: { emailId: "msg_1" },
      })),
    };
    const deliveries = ledger();
    const handler = createResendWebhookHandler({
      verifier,
      ledger: deliveries,
      now: () => new Date("2026-07-24T00:01:00.000Z"),
    });

    const response = await handler(
      new Request("https://example.test/api/webhooks/resend", {
        method: "POST",
        headers: signedHeaders,
        body: raw,
      }),
    );

    expect(response.status).toBe(200);
    expect(verifier.verify).toHaveBeenCalledWith(raw, {
      id: "evt_123",
      timestamp: "1784851200",
      signature: "v1,signature",
    });
    expect(deliveries.record).toHaveBeenCalledWith({
      eventId: "evt_123",
      providerMessageId: "msg_1",
      state: "delivered",
      providerCreatedAt: new Date("2026-07-24T00:00:03.000Z"),
      receivedAt: new Date("2026-07-24T00:01:00.000Z"),
    });
  });

  it("rejects a missing signature header before reading provider data", async () => {
    const verifier: ResendWebhookVerifier = { verify: vi.fn() };
    const deliveries = ledger();
    const handler = createResendWebhookHandler({ verifier, ledger: deliveries });

    const response = await handler(
      new Request("https://example.test/api/webhooks/resend", {
        method: "POST",
        headers: { "svix-id": "evt_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    expect(verifier.verify).not.toHaveBeenCalled();
    expect(deliveries.record).not.toHaveBeenCalled();
  });

  it("acknowledges an atomic duplicate without applying it twice", async () => {
    const verifier: ResendWebhookVerifier = {
      verify: vi.fn(() => ({
        type: "email.bounced",
        createdAt: "2026-07-24T00:00:00.000Z",
        data: { emailId: "msg_1" },
      })),
    };
    const deliveries = ledger();
    vi.mocked(deliveries.record).mockResolvedValue({ duplicate: true });
    const handler = createResendWebhookHandler({ verifier, ledger: deliveries });

    const response = await handler(
      new Request("https://example.test/api/webhooks/resend", {
        method: "POST",
        headers: signedHeaders,
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "duplicate" });
  });

  it("persists out-of-order events as separate immutable ledger entries", async () => {
    const deliveries = ledger();
    const verifier: ResendWebhookVerifier = {
      verify: vi
        .fn()
        .mockReturnValueOnce({
          type: "email.delivered",
          createdAt: "2026-07-24T00:00:10.000Z",
          data: { emailId: "msg_1" },
        })
        .mockReturnValueOnce({
          type: "email.sent",
          createdAt: "2026-07-24T00:00:05.000Z",
          data: { emailId: "msg_1" },
        }),
    };
    const handler = createResendWebhookHandler({ verifier, ledger: deliveries });

    for (const eventId of ["evt_later", "evt_earlier"]) {
      await handler(
        new Request("https://example.test/api/webhooks/resend", {
          method: "POST",
          headers: { ...signedHeaders, "svix-id": eventId },
          body: "{}",
        }),
      );
    }

    expect(deliveries.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventId: "evt_earlier",
        state: "sent",
        providerCreatedAt: new Date("2026-07-24T00:00:05.000Z"),
      }),
    );
  });
});
