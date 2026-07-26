import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/platform/database/client";
import { requestCorrelationId } from "@/platform/observability/telemetry";

import {
  identityEmailDeliveries,
  identityEmailOutbox,
} from "../schema";

export type NormalizedDeliveryState =
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed";

export type VerifiedResendEvent = {
  type: string;
  createdAt: string;
  data: { emailId: string };
};

export type ResendWebhookVerifier = {
  verify(
    payload: string,
    headers: { id: string; timestamp: string; signature: string },
  ): VerifiedResendEvent;
};

export type ResendDeliveryLedger = {
  record(input: {
    eventId: string;
    providerMessageId: string;
    state: NormalizedDeliveryState;
    providerCreatedAt: Date;
    receivedAt: Date;
  }): Promise<{ duplicate: boolean }>;
};

const deliveryState: Partial<Record<string, NormalizedDeliveryState>> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "failed",
};

export function createResendWebhookHandler(input: {
  verifier: ResendWebhookVerifier;
  ledger:
    | ResendDeliveryLedger
    | (() => Promise<{
        ledger: ResendDeliveryLedger;
        close?(): Promise<void>;
      }>);
  now?: () => Date;
  telemetry?(
    event: string,
    fields: Record<string, string | number | boolean>,
  ): void;
}) {
  const now = input.now ?? (() => new Date());
  return async (request: Request): Promise<Response> => {
    const correlationId = requestCorrelationId(request);
    const respond = (status: number, body: Record<string, unknown>) =>
      Response.json(body, {
        status,
        headers: { "x-correlation-id": correlationId },
      });
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!id || !timestamp || !signature) {
      input.telemetry?.("identity.webhook.rejected", {
        correlationId,
        reason: "missing_signature_headers",
      });
      return respond(400, { error: "webhook signature headers are required" });
    }
    let event: VerifiedResendEvent;
    try {
      const rawBody = await request.text();
      event = input.verifier.verify(rawBody, { id, timestamp, signature });
    } catch {
      input.telemetry?.("identity.webhook.rejected", {
        correlationId,
        reason: "signature_verification_failed",
      });
      return respond(400, { error: "webhook signature is invalid" });
    }
    const state = deliveryState[event.type];
    if (!state) {
      input.telemetry?.("identity.webhook.ignored", {
        correlationId,
        eventType: event.type.slice(0, 64),
      });
      return respond(200, { status: "ignored" });
    }
    const providerCreatedAt = new Date(event.createdAt);
    if (
      !event.data.emailId ||
      event.data.emailId.length > 256 ||
      Number.isNaN(providerCreatedAt.getTime())
    ) {
      input.telemetry?.("identity.webhook.rejected", {
        correlationId,
        reason: "invalid_event",
      });
      return respond(400, { error: "webhook event is invalid" });
    }
    const resource =
      typeof input.ledger === "function"
        ? await input.ledger()
        : { ledger: input.ledger };
    try {
      const result = await resource.ledger.record({
        eventId: id,
        providerMessageId: event.data.emailId,
        state,
        providerCreatedAt,
        receivedAt: now(),
      });
      input.telemetry?.("identity.webhook.recorded", {
        correlationId,
        state,
        duplicate: result.duplicate,
      });
      return respond(200, {
        status: result.duplicate ? "duplicate" : "processed",
      });
    } finally {
      await resource.close?.();
    }
  };
}

export function createPostgresResendDeliveryLedger(
  database: AppDatabase,
): ResendDeliveryLedger {
  return {
    record: (input) =>
      database.transaction(async (transaction) => {
        const outbox = await transaction
          .select({ id: identityEmailOutbox.id })
          .from(identityEmailOutbox)
          .where(
            eq(identityEmailOutbox.providerMessageId, input.providerMessageId),
          )
          .limit(1);
        const inserted = await transaction
          .insert(identityEmailDeliveries)
          .values({
            eventId: input.eventId,
            outboxId: outbox[0]?.id ?? null,
            providerMessageId: input.providerMessageId,
            state: input.state,
            providerCreatedAt: input.providerCreatedAt,
            receivedAt: input.receivedAt,
          })
          .onConflictDoNothing({
            target: identityEmailDeliveries.eventId,
          })
          .returning({ id: identityEmailDeliveries.id });
        return { duplicate: inserted.length === 0 };
      }),
  };
}
