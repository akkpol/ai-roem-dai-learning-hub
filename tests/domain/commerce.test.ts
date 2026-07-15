import { describe, expect, it } from "vitest";
import {
  checkoutExpiresAt,
  decideFulfillment,
  paymentDeadlineAt,
  type FulfillmentInput,
} from "@/lib/domain/commerce";

const openedAt = new Date("2026-07-14T03:00:00.000Z");
const deadline = new Date("2026-07-16T03:00:00.000Z");
const paid: FulfillmentInput = {
  orderStatus: "pending",
  paymentStatus: "paid",
  expectedAmount: 490000,
  paidAmount: 490000,
  expectedCurrency: "thb",
  paidCurrency: "thb",
  paymentDeadlineAt: deadline,
  receivedAt: new Date("2026-07-15T04:00:00.000Z"),
};

describe("paid cohort commerce", () => {
  it("opens a fixed 48-hour payment window", () => {
    expect(paymentDeadlineAt(openedAt)).toEqual(deadline);
  });

  it("limits each Checkout Session to 24 hours and never beyond the order deadline", () => {
    expect(checkoutExpiresAt(openedAt, deadline)).toEqual(
      new Date("2026-07-15T03:00:00.000Z"),
    );
    expect(
      checkoutExpiresAt(new Date("2026-07-15T20:00:00.000Z"), deadline),
    ).toEqual(deadline);
  });

  it("rejects a new Checkout Session when fewer than 30 minutes remain", () => {
    expect(() =>
      checkoutExpiresAt(new Date("2026-07-16T02:31:00.000Z"), deadline),
    ).toThrow("30 นาที");
  });

  it("fulfills only paid, amount-matched, currency-matched orders within the deadline", () => {
    expect(decideFulfillment(paid)).toBe("fulfill");
    expect(decideFulfillment({ ...paid, paymentStatus: "unpaid" })).toBe("await_payment");
    expect(decideFulfillment({ ...paid, paidAmount: 4900 })).toBe("reject_mismatch");
    expect(decideFulfillment({ ...paid, paidCurrency: "usd" })).toBe("reject_mismatch");
  });

  it("is idempotent and sends late success to the full-refund queue", () => {
    expect(decideFulfillment({ ...paid, orderStatus: "paid" })).toBe("already_fulfilled");
    expect(
      decideFulfillment({
        ...paid,
        orderStatus: "expired",
        receivedAt: new Date("2026-07-16T03:00:00.001Z"),
      }),
    ).toBe("refund_late");
  });
});
