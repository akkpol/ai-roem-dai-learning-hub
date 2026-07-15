import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { providerWebhookEvents } from "@/db/schema";
import { stripeEventAction } from "@/lib/domain/commerce";
import {
  fulfillCheckoutSession,
  markCheckoutExpired,
  markCheckoutFailed,
  updateRefundFromStripe,
} from "@/lib/services/commerce";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing Stripe signature" }, { status: 400 });
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch {
    return Response.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const db = getDb();
  const [recorded] = await db
    .insert(providerWebhookEvents)
    .values({
      provider: "stripe",
      providerEventId: event.id,
      eventType: event.type,
      payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    })
    .onConflictDoNothing({
      target: [providerWebhookEvents.provider, providerWebhookEvents.providerEventId],
    })
    .returning({ id: providerWebhookEvents.id });
  if (!recorded) return Response.json({ received: true, duplicate: true });

  try {
    const action = stripeEventAction(event.type);
    if (action === "fulfill_checkout") {
      await fulfillCheckoutSession((event.data.object as Stripe.Checkout.Session).id);
    } else if (action === "payment_failed") {
      await markCheckoutFailed((event.data.object as Stripe.Checkout.Session).id);
    } else if (action === "checkout_expired") {
      await markCheckoutExpired((event.data.object as Stripe.Checkout.Session).id);
    } else if (action === "refund_updated") {
      await updateRefundFromStripe(event.data.object as Stripe.Refund);
    }
    await db
      .update(providerWebhookEvents)
      .set({
        status: action === "ignore" ? "ignored" : "processed",
        processedAt: new Date(),
      })
      .where(eq(providerWebhookEvents.id, recorded.id));
    return Response.json({ received: true });
  } catch (error) {
    await db
      .update(providerWebhookEvents)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(providerWebhookEvents.id, recorded.id));
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
