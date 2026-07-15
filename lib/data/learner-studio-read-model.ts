import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import { checkoutSessions, cohorts, courses, enrollments, liveSessions, orders } from "@/db/schema";
import { selectNextAction, type LearnerActionKind } from "@/lib/domain/learner-next-action";
import { canUseDemoData } from "./demo-policy";

export type LearnerNextActionView = {
  kind: LearnerActionKind;
  title: string;
  detail: string;
  dueAt: Date | null;
  href: string;
  reservationId: string | null;
  amount: number | null;
} | null;

export async function getLearnerNextAction(
  userId: string,
  demo = false,
): Promise<LearnerNextActionView> {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return {
      kind: "session",
      title: "เข้าเรียน AI Fundamentals รุ่นกรกฎาคม",
      detail: "คลาสสดครั้งถัดไป พรุ่งนี้ 19:00 น.",
      dueAt: new Date("2026-07-15T12:00:00.000Z"),
      href: "/learn/demo-enrollment",
      reservationId: null,
      amount: null,
    };
  }
  if (!hasDatabaseConnection()) return null;
  const db = getDb();
  const [payment] = await db
    .select({
      kind: orders.status,
      courseTitle: courses.title,
      cohortTitle: cohorts.title,
      dueAt: orders.paymentDeadlineAt,
      reservationId: orders.reservationId,
      amount: orders.amount,
    })
    .from(orders)
    .innerJoin(cohorts, eq(cohorts.id, orders.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(orders.userId, userId), inArray(orders.status, ["pending", "payment_failed"])))
    .orderBy(asc(orders.paymentDeadlineAt))
    .limit(1);
  const [session] = await db
    .select({
      enrollmentId: enrollments.id,
      courseTitle: courses.title,
      cohortTitle: cohorts.title,
      dueAt: liveSessions.startsAt,
    })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .innerJoin(liveSessions, eq(liveSessions.cohortId, cohorts.id))
    .where(and(eq(enrollments.userId, userId), eq(enrollments.status, "active")))
    .orderBy(asc(liveSessions.startsAt))
    .limit(1);
  const candidates = [
    payment
      ? {
          kind: "payment" as const,
          title: `ชำระเงิน ${payment.courseTitle}`,
          detail: `${payment.cohortTitle} · ที่นั่งจะถูกปล่อยเมื่อหมดเวลา`,
          dueAt: payment.dueAt,
          href: "/learn/payment",
          reservationId: payment.reservationId,
          amount: payment.amount,
        }
      : null,
    session
      ? {
          kind: "session" as const,
          title: `เข้าเรียน ${session.courseTitle}`,
          detail: session.cohortTitle,
          dueAt: session.dueAt,
          href: `/learn/${session.enrollmentId}`,
          reservationId: null,
          amount: null,
        }
      : null,
  ].filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  return selectNextAction(candidates);
}

export async function getLearnerPaymentStatus(
  providerSessionId: string,
  userId: string,
  demo = false,
) {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return { courseTitle: "AI Fundamentals", cohortTitle: "รุ่นกรกฎาคม", status: "pending" as const, amount: 490000 };
  }
  if (!hasDatabaseConnection() || !providerSessionId) return null;
  const [row] = await getDb()
    .select({ courseTitle: courses.title, cohortTitle: cohorts.title, status: orders.status, amount: orders.amount })
    .from(checkoutSessions)
    .innerJoin(orders, eq(orders.id, checkoutSessions.orderId))
    .innerJoin(cohorts, eq(cohorts.id, orders.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(checkoutSessions.providerSessionId, providerSessionId), eq(orders.userId, userId)))
    .limit(1);
  return row ?? null;
}
