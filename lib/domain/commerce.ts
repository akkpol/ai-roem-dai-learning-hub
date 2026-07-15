const HOUR_MS = 60 * 60 * 1000;
const MINIMUM_CHECKOUT_WINDOW_MS = 30 * 60 * 1000;

export type OrderStatus =
  | "pending"
  | "paid"
  | "expired"
  | "payment_failed"
  | "refund_pending"
  | "refunded";

export type FulfillmentInput = {
  orderStatus: OrderStatus;
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  expectedAmount: number;
  paidAmount: number | null;
  expectedCurrency: string;
  paidCurrency: string | null;
  paymentDeadlineAt: Date;
  receivedAt: Date;
};

export type FulfillmentDecision =
  | "fulfill"
  | "already_fulfilled"
  | "await_payment"
  | "reject_mismatch"
  | "refund_late";

export type StripeEventAction =
  | "fulfill_checkout"
  | "payment_failed"
  | "checkout_expired"
  | "refund_updated"
  | "ignore";

export function paymentDeadlineAt(openedAt: Date) {
  return new Date(openedAt.getTime() + 48 * HOUR_MS);
}

export function checkoutExpiresAt(now: Date, orderDeadlineAt: Date) {
  const remaining = orderDeadlineAt.getTime() - now.getTime();
  if (remaining < MINIMUM_CHECKOUT_WINDOW_MS) {
    throw new Error("ต้องเหลือเวลาอย่างน้อย 30 นาทีจึงจะสร้าง Checkout Session ใหม่ได้");
  }
  return new Date(Math.min(now.getTime() + 24 * HOUR_MS, orderDeadlineAt.getTime()));
}

export function decideFulfillment(input: FulfillmentInput): FulfillmentDecision {
  if (input.paymentStatus === "unpaid") return "await_payment";
  if (
    input.paidAmount !== input.expectedAmount ||
    input.paidCurrency?.toLowerCase() !== input.expectedCurrency.toLowerCase()
  ) {
    return "reject_mismatch";
  }
  if (input.orderStatus === "paid") return "already_fulfilled";
  if (
    input.orderStatus === "expired" ||
    input.orderStatus === "refund_pending" ||
    input.orderStatus === "refunded" ||
    input.receivedAt.getTime() > input.paymentDeadlineAt.getTime()
  ) {
    return "refund_late";
  }
  return "fulfill";
}

export function stripeEventAction(eventType: string): StripeEventAction {
  if (
    eventType === "checkout.session.completed" ||
    eventType === "checkout.session.async_payment_succeeded"
  ) {
    return "fulfill_checkout";
  }
  if (eventType === "checkout.session.async_payment_failed") return "payment_failed";
  if (eventType === "checkout.session.expired") return "checkout_expired";
  if (eventType === "refund.created" || eventType === "refund.updated") return "refund_updated";
  return "ignore";
}
