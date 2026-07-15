import { describe, expect, it } from "vitest";
import { stripeEventAction } from "@/lib/domain/commerce";

describe("Stripe webhook routing", () => {
  it("routes immediate and delayed Checkout success to the same fulfillment path", () => {
    expect(stripeEventAction("checkout.session.completed")).toBe("fulfill_checkout");
    expect(stripeEventAction("checkout.session.async_payment_succeeded")).toBe("fulfill_checkout");
  });

  it("routes failures, expiry, and refund state without granting access", () => {
    expect(stripeEventAction("checkout.session.async_payment_failed")).toBe("payment_failed");
    expect(stripeEventAction("checkout.session.expired")).toBe("checkout_expired");
    expect(stripeEventAction("refund.updated")).toBe("refund_updated");
    expect(stripeEventAction("customer.created")).toBe("ignore");
  });
});
