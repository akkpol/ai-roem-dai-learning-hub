import { and, asc, count, eq, inArray, lte } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  checkoutSessions,
  cohortStatusHistory,
  cohorts,
  courses,
  enrollments,
  orders,
  refunds,
  seatReservations,
} from "@/db/schema";
import { requireAdmin, requireMember } from "@/lib/auth/authorization";
import {
  checkoutExpiresAt,
  decideFulfillment,
  paymentDeadlineAt,
  type OrderStatus,
} from "@/lib/domain/commerce";
import { getStripe } from "@/lib/stripe/server";
import { learningStudioFlags } from "@/lib/feature-flags";

const uuid = z.string().uuid();
const checkoutableOrderStatuses: OrderStatus[] = ["pending", "payment_failed"];

function assertPaymentsEnabled() {
  if (!learningStudioFlags.payments) throw new Error("ระบบชำระเงินยังไม่เปิดใช้งานใน environment นี้");
}

function appOrigin() {
  const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (origin) return origin.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("APP_URL is not configured");
}

function refundPolicySnapshot(startsAt: Date, amount: number) {
  return {
    refundVersion: "full-refund-v1",
    refundableUntil: new Date(startsAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    priceLabel: new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(amount / 100),
  };
}

export async function openPaymentCollection(rawCohortId: string) {
  assertPaymentsEnabled();
  const cohortId = uuid.parse(rawCohortId);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, cohortId))
      .for("update")
      .limit(1);
    if (!cohort) throw new Error("ไม่พบรุ่นเรียน");
    if (cohort.status !== "threshold_met") {
      throw new Error("เปิดชำระเงินได้เมื่อ reservation ถึงขั้นต่ำแล้วเท่านั้น");
    }
    if (cohort.priceAmount <= 0) throw new Error("กรุณาอนุมัติราคาก่อนเปิดชำระเงิน");
    if (!cohort.courseRevisionId) throw new Error("กรุณาเลือก revision ที่อนุมัติก่อนเปิดชำระเงิน");
    const now = new Date();
    const deadline = paymentDeadlineAt(now);
    const reservations = await tx
      .select()
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.cohortId, cohortId),
          eq(seatReservations.status, "active"),
        ),
      );
    for (const reservation of reservations) {
      await tx
        .insert(orders)
        .values({
          reservationId: reservation.id,
          userId: reservation.userId,
          cohortId,
          amount: cohort.priceAmount,
          currency: cohort.currency,
          paymentDeadlineAt: deadline,
          policySnapshot: refundPolicySnapshot(cohort.startsAt, cohort.priceAmount),
        })
        .onConflictDoNothing({ target: orders.reservationId });
    }
    await tx
      .update(cohorts)
      .set({
        status: "payment_collecting",
        paymentOpenedAt: now,
        paymentDeadlineAt: deadline,
        updatedAt: now,
      })
      .where(eq(cohorts.id, cohortId));
    await tx.insert(cohortStatusHistory).values({
      cohortId,
      fromStatus: "threshold_met",
      toStatus: "payment_collecting",
      actorUserId: admin.userId,
      reason: "admin_opened_payment",
    });
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: "cohort.open_payment",
      entityType: "cohort",
      entityId: cohortId,
      metadata: { deadline: deadline.toISOString(), ordersCreated: reservations.length },
    });
    return { deadline, ordersCreated: reservations.length };
  });
}

export async function createCheckoutForReservation(rawReservationId: string) {
  assertPaymentsEnabled();
  const reservationId = uuid.parse(rawReservationId);
  const member = await requireMember();
  const db = getDb();
  const [row] = await db
    .select({
      order: orders,
      cohortTitle: cohorts.title,
      courseTitle: courses.title,
    })
    .from(orders)
    .innerJoin(cohorts, eq(cohorts.id, orders.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(orders.reservationId, reservationId), eq(orders.userId, member.userId)))
    .limit(1);
  if (!row) throw new Error("ไม่พบคำสั่งชำระเงินของคุณ");
  if (!checkoutableOrderStatuses.includes(row.order.status)) {
    throw new Error("คำสั่งชำระเงินนี้ไม่สามารถสร้าง Checkout ใหม่ได้");
  }
  const now = new Date();
  const expiresAt = checkoutExpiresAt(now, row.order.paymentDeadlineAt);
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: row.order.id,
      customer_email: member.email,
      locale: "th",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: row.order.currency.toLowerCase(),
            unit_amount: row.order.amount,
            product_data: {
              name: row.courseTitle,
              description: row.cohortTitle,
            },
          },
        },
      ],
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      success_url: `${appOrigin()}/learn/payment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin()}/learn?payment=cancelled`,
      metadata: { orderId: row.order.id, reservationId },
      payment_intent_data: { metadata: { orderId: row.order.id, reservationId } },
    },
    { idempotencyKey: `checkout-${row.order.id}-${Math.floor(now.getTime() / (30 * 60 * 1000))}` },
  );
  if (!session.url) throw new Error("Stripe ไม่ได้ส่ง Checkout URL กลับมา");
  await db.transaction(async (tx) => {
    await tx.insert(checkoutSessions).values({
      orderId: row.order.id,
      providerSessionId: session.id,
      checkoutUrl: session.url,
      expiresAt,
    }).onConflictDoNothing({ target: checkoutSessions.providerSessionId });
    if (row.order.status === "payment_failed") {
      await tx.update(orders).set({ status: "pending", updatedAt: now }).where(eq(orders.id, row.order.id));
    }
  });
  return { url: session.url, expiresAt };
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

export async function fulfillCheckoutSession(providerSessionId: string, receivedAt = new Date()) {
  const stripeSession = await getStripe().checkout.sessions.retrieve(providerSessionId, {
    expand: ["payment_intent"],
  });
  const db = getDb();
  const [local] = await db
    .select({ orderId: checkoutSessions.orderId })
    .from(checkoutSessions)
    .where(eq(checkoutSessions.providerSessionId, providerSessionId))
    .limit(1);
  if (!local) throw new Error("ไม่พบ Checkout Session ในระบบ");

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, local.orderId))
      .for("update")
      .limit(1);
    if (!order) throw new Error("ไม่พบ order");
    const decision = decideFulfillment({
      orderStatus: order.status,
      paymentStatus: stripeSession.payment_status,
      expectedAmount: order.amount,
      paidAmount: stripeSession.amount_total,
      expectedCurrency: order.currency,
      paidCurrency: stripeSession.currency,
      paymentDeadlineAt: order.paymentDeadlineAt,
      receivedAt,
    });
    if (decision === "already_fulfilled" || decision === "await_payment") return decision;
    if (decision === "reject_mismatch") throw new Error("ยอดเงินหรือสกุลเงินจาก Stripe ไม่ตรงกับ order");
    if (decision === "refund_late") {
      await tx.update(orders).set({
        status: "refund_pending",
        providerPaymentIntentId: paymentIntentId(stripeSession),
        updatedAt: receivedAt,
      }).where(eq(orders.id, order.id));
      await tx.insert(refunds).values({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        reason: "late_payment",
        status: "approved",
      }).onConflictDoNothing({ target: [refunds.orderId, refunds.reason] });
      return decision;
    }

    const [cohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, order.cohortId))
      .for("update")
      .limit(1);
    if (!cohort?.courseRevisionId) throw new Error("cohort ไม่มี revision snapshot");
    await tx.update(orders).set({
      status: "paid",
      providerPaymentIntentId: paymentIntentId(stripeSession),
      paidAt: receivedAt,
      updatedAt: receivedAt,
    }).where(eq(orders.id, order.id));
    await tx.update(checkoutSessions).set({ status: "complete", completedAt: receivedAt }).where(eq(checkoutSessions.providerSessionId, providerSessionId));
    await tx.update(seatReservations).set({ status: "converted", convertedAt: receivedAt, updatedAt: receivedAt }).where(eq(seatReservations.id, order.reservationId));
    await tx.insert(enrollments).values({
      userId: order.userId,
      cohortId: order.cohortId,
      reservationId: order.reservationId,
      orderId: order.id,
      courseRevisionId: cohort.courseRevisionId,
    }).onConflictDoNothing({ target: enrollments.reservationId });
    const [paidCount] = await tx.select({ value: count(orders.id) }).from(orders).where(and(eq(orders.cohortId, order.cohortId), eq(orders.status, "paid")));
    if (Number(paidCount?.value ?? 0) >= cohort.minimumEnrollment && cohort.status === "payment_collecting") {
      await tx.update(cohorts).set({ status: "confirmed", confirmedAt: receivedAt, updatedAt: receivedAt }).where(eq(cohorts.id, cohort.id));
      await tx.insert(cohortStatusHistory).values({ cohortId: cohort.id, fromStatus: "payment_collecting", toStatus: "confirmed", reason: "paid_threshold_reached" });
    }
    await tx.insert(auditLogs).values({
      actorUserId: order.userId,
      action: "order.fulfill",
      entityType: "order",
      entityId: order.id,
      metadata: { providerSessionId },
    });
    return decision;
  });
}

export async function markCheckoutFailed(providerSessionId: string) {
  return getDb().transaction(async (tx) => {
    const [session] = await tx.select().from(checkoutSessions).where(eq(checkoutSessions.providerSessionId, providerSessionId)).limit(1);
    if (!session) return "missing" as const;
    await tx.update(checkoutSessions).set({ status: "complete", completedAt: new Date() }).where(eq(checkoutSessions.id, session.id));
    await tx.update(orders).set({ status: "payment_failed", updatedAt: new Date() }).where(and(eq(orders.id, session.orderId), eq(orders.status, "pending")));
    return "updated" as const;
  });
}

export async function markCheckoutExpired(providerSessionId: string) {
  return getDb().update(checkoutSessions).set({ status: "expired" }).where(eq(checkoutSessions.providerSessionId, providerSessionId));
}

export async function expirePaymentWindows(now = new Date()) {
  const db = getDb();
  const expired = await db.select().from(orders).where(and(inArray(orders.status, ["pending", "payment_failed"]), lte(orders.paymentDeadlineAt, now)));
  for (const order of expired) {
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update").limit(1);
      if (!locked || !["pending", "payment_failed"].includes(locked.status)) return;
      await tx.update(orders).set({ status: "expired", expiredAt: now, updatedAt: now }).where(eq(orders.id, locked.id));
      await tx.update(seatReservations).set({ status: "expired", expiresAt: now, updatedAt: now }).where(eq(seatReservations.id, locked.reservationId));
      const [waitlisted] = await tx.select().from(seatReservations).where(and(eq(seatReservations.cohortId, locked.cohortId), eq(seatReservations.status, "waitlisted"))).orderBy(asc(seatReservations.reservedAt)).for("update").limit(1);
      if (waitlisted) {
        const [cohort] = await tx.select().from(cohorts).where(eq(cohorts.id, locked.cohortId)).limit(1);
        if (cohort) {
          const deadline = paymentDeadlineAt(now);
          await tx.update(seatReservations).set({ status: "active", expiresAt: deadline, updatedAt: now }).where(eq(seatReservations.id, waitlisted.id));
          await tx.insert(orders).values({
            reservationId: waitlisted.id,
            userId: waitlisted.userId,
            cohortId: waitlisted.cohortId,
            amount: cohort.priceAmount,
            currency: cohort.currency,
            paymentDeadlineAt: deadline,
            policySnapshot: refundPolicySnapshot(cohort.startsAt, cohort.priceAmount),
          }).onConflictDoNothing({ target: orders.reservationId });
        }
      }
    });
  }
  return expired.length;
}

export async function queueFullRefund(input: {
  orderId: string;
  reason: "learner_request" | "platform_cancellation" | "late_payment";
  requestedByUserId?: string;
  autoApprove?: boolean;
}) {
  const orderId = uuid.parse(input.orderId);
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order || !order.paidAt) throw new Error("คืนเงินได้เฉพาะ order ที่ชำระแล้ว");
    const [refund] = await tx.insert(refunds).values({
      orderId,
      amount: order.amount,
      currency: order.currency,
      reason: input.reason,
      status: input.autoApprove ? "approved" : "requested",
      requestedByUserId: input.requestedByUserId,
    }).onConflictDoNothing({ target: [refunds.orderId, refunds.reason] }).returning();
    await tx.update(orders).set({ status: "refund_pending", updatedAt: new Date() }).where(eq(orders.id, orderId));
    return refund;
  });
}

export async function issueApprovedRefund(rawRefundId: string) {
  const refundId = uuid.parse(rawRefundId);
  const admin = await requireAdmin();
  const [row] = await getDb().select({ refund: refunds, order: orders }).from(refunds).innerJoin(orders, eq(orders.id, refunds.orderId)).where(eq(refunds.id, refundId)).limit(1);
  if (!row) throw new Error("ไม่พบ refund");
  if (!row.order.providerPaymentIntentId) throw new Error("order ไม่มี PaymentIntent สำหรับคืนเงิน");
  if (!(["approved", "failed"] as const).includes(row.refund.status as "approved" | "failed")) throw new Error("refund ยังไม่พร้อมดำเนินการ");
  const stripeRefund = await getStripe().refunds.create({
    payment_intent: row.order.providerPaymentIntentId,
    amount: row.refund.amount,
    metadata: { refundId: row.refund.id, orderId: row.order.id },
  }, { idempotencyKey: `refund-${row.refund.id}` });
  const status = stripeRefund.status === "succeeded" ? "succeeded" : stripeRefund.status === "failed" || stripeRefund.status === "canceled" ? "failed" : "processing";
  await getDb().transaction(async (tx) => {
    await tx.update(refunds).set({
      status,
      providerRefundId: stripeRefund.id,
      approvedByUserId: admin.userId,
      updatedAt: new Date(),
      completedAt: status === "succeeded" ? new Date() : null,
      failureMessage: stripeRefund.failure_reason ?? null,
    }).where(eq(refunds.id, row.refund.id));
    if (status === "succeeded") {
      await tx.update(orders).set({ status: "refunded", updatedAt: new Date() }).where(eq(orders.id, row.order.id));
      await tx.update(enrollments).set({ status: "cancelled" }).where(eq(enrollments.orderId, row.order.id));
    }
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "refund.issue", entityType: "refund", entityId: row.refund.id, metadata: { providerRefundId: stripeRefund.id, status } });
  });
  return stripeRefund;
}

export async function updateRefundFromStripe(stripeRefund: Stripe.Refund) {
  const status = stripeRefund.status === "succeeded" ? "succeeded" : stripeRefund.status === "failed" || stripeRefund.status === "canceled" ? "failed" : "processing";
  return getDb().transaction(async (tx) => {
    const [refund] = await tx.update(refunds).set({ status, failureMessage: stripeRefund.failure_reason ?? null, updatedAt: new Date(), completedAt: status === "succeeded" ? new Date() : null }).where(eq(refunds.providerRefundId, stripeRefund.id)).returning();
    if (!refund) return null;
    if (status === "succeeded") {
      await tx.update(orders).set({ status: "refunded", updatedAt: new Date() }).where(eq(orders.id, refund.orderId));
      await tx.update(enrollments).set({ status: "cancelled" }).where(eq(enrollments.orderId, refund.orderId));
    }
    return refund;
  });
}
