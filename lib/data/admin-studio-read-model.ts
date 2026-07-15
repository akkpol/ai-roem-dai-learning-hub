import { asc, eq } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import { cohorts, courses, memberRoles, orders, profiles, refunds } from "@/db/schema";
import { canUseDemoData } from "./demo-policy";

export async function getAccessManagementData(demo = false) {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) return {
    members: [
      { userId: "demo-admin", displayName: "กาญจนา", email: "kanyaporn@example.com", roles: ["student", "instructor", "admin"] as const },
      { userId: "demo-instructor", displayName: "ณัฐพงศ์", email: "natthapong@example.com", roles: ["student", "instructor"] as const },
    ],
    courses: [{ id: "00000000-0000-4000-8000-000000000001", title: "AI Fundamentals" }],
    cohorts: [{ id: "00000000-0000-4000-8000-000000000103", title: "AI Fundamentals รุ่นกรกฎาคม" }],
  };
  if (!hasDatabaseConnection()) return { members: [], courses: [], cohorts: [] };
  const db = getDb();
  const [profileRows, roleRows, courseRows, cohortRows] = await Promise.all([
    db.select().from(profiles).orderBy(asc(profiles.displayName)),
    db.select().from(memberRoles),
    db.select({ id: courses.id, title: courses.title }).from(courses).orderBy(asc(courses.title)),
    db.select({ id: cohorts.id, title: cohorts.title }).from(cohorts).orderBy(asc(cohorts.startsAt)),
  ]);
  return {
    members: profileRows.map((profile) => ({
      userId: profile.userId,
      displayName: profile.displayName,
      email: profile.email,
      roles: roleRows.filter((role) => role.userId === profile.userId).map((role) => role.role),
    })),
    courses: courseRows,
    cohorts: cohortRows,
  };
}

export async function getPaymentAdminData(demo = false) {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) return {
    orders: [{ id: "order-demo", learner: "ชลิตา", cohortTitle: "AI Fundamentals รุ่นกรกฎาคม", amount: 490000, status: "paid", deadline: new Date("2026-07-16T03:00:00.000Z") }],
    refunds: [{ id: "00000000-0000-4000-8000-000000000601", learner: "ชลิตา", amount: 490000, reason: "learner_request", status: "approved" }],
  };
  if (!hasDatabaseConnection()) return { orders: [], refunds: [] };
  const db = getDb();
  const orderRows = await db.select({ id: orders.id, learner: profiles.displayName, cohortTitle: cohorts.title, amount: orders.amount, status: orders.status, deadline: orders.paymentDeadlineAt }).from(orders).innerJoin(profiles, eq(profiles.userId, orders.userId)).innerJoin(cohorts, eq(cohorts.id, orders.cohortId)).orderBy(asc(orders.paymentDeadlineAt));
  const refundRows = await db.select({ id: refunds.id, learner: profiles.displayName, amount: refunds.amount, reason: refunds.reason, status: refunds.status }).from(refunds).innerJoin(orders, eq(orders.id, refunds.orderId)).innerJoin(profiles, eq(profiles.userId, orders.userId)).orderBy(asc(refunds.createdAt));
  return { orders: orderRows, refunds: refundRows };
}
