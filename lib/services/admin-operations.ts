import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  cohortStatusHistory,
  cohorts,
  courseMaterials,
  courses,
  enrollments,
  liveSessions,
  sessionAttendance,
  submissions,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/authorization";

const uuid = z.string().uuid();
const capacitySchema = z
  .object({
    minimumEnrollment: z.coerce.number().int().min(1).max(50),
    maximumEnrollment: z.coerce.number().int().min(1).max(50),
  })
  .refine((value) => value.maximumEnrollment >= value.minimumEnrollment, {
    message: "จำนวนสูงสุดต้องไม่น้อยกว่าจำนวนขั้นต่ำ",
  });
const scheduleSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    registrationOpensAt: z.coerce.date(),
    registrationDeadlineAt: z.coerce.date(),
  })
  .refine((value) => value.registrationOpensAt <= value.registrationDeadlineAt, {
    message: "วันเปิดรับต้องไม่อยู่หลังวันปิดรับ",
  })
  .refine((value) => value.registrationDeadlineAt < value.startsAt, {
    message: "วันปิดรับต้องอยู่ก่อนวันเริ่มเรียน",
  })
  .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
    message: "วันจบต้องอยู่หลังวันเริ่มเรียน",
  });

export async function createCohortByAdmin(input: {
  courseId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  registrationOpensAt: string;
  registrationDeadlineAt: string;
  minimumEnrollment: number | string;
  maximumEnrollment: number | string;
}) {
  const parsed = z
    .object({ courseId: uuid, title: z.string().trim().min(3).max(200) })
    .and(capacitySchema)
    .and(scheduleSchema)
    .parse(input);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [course] = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, parsed.courseId))
      .limit(1);
    if (!course) throw new Error("ไม่พบหลักสูตร");
    const [created] = await tx
      .insert(cohorts)
      .values({
        courseId: parsed.courseId,
        title: parsed.title,
        status: "draft",
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        registrationOpensAt: parsed.registrationOpensAt,
        registrationDeadlineAt: parsed.registrationDeadlineAt,
        minimumEnrollment: parsed.minimumEnrollment,
        maximumEnrollment: parsed.maximumEnrollment,
      })
      .returning();
    await tx.insert(cohortStatusHistory).values({
      cohortId: created.id,
      fromStatus: null,
      toStatus: "draft",
      actorUserId: admin.userId,
      reason: "admin_created",
    });
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: "cohort.create",
      entityType: "cohort",
      entityId: created.id,
    });
    return created;
  });
}

export async function updateCohortByAdmin(input: {
  cohortId: string;
  startsAt: string;
  registrationOpensAt: string;
  registrationDeadlineAt: string;
  minimumEnrollment: number | string;
  maximumEnrollment: number | string;
}) {
  const parsed = z
    .object({ cohortId: uuid, startsAt: z.coerce.date(), registrationOpensAt: z.coerce.date(), registrationDeadlineAt: z.coerce.date() })
    .and(capacitySchema)
    .refine((value) => value.registrationOpensAt <= value.registrationDeadlineAt, { message: "วันเปิดรับต้องไม่อยู่หลังวันปิดรับ" })
    .refine((value) => value.registrationDeadlineAt < value.startsAt, { message: "วันปิดรับต้องอยู่ก่อนวันเริ่มเรียน" })
    .parse(input);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(cohorts)
      .set({
        startsAt: parsed.startsAt,
        registrationOpensAt: parsed.registrationOpensAt,
        registrationDeadlineAt: parsed.registrationDeadlineAt,
        minimumEnrollment: parsed.minimumEnrollment,
        maximumEnrollment: parsed.maximumEnrollment,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cohorts.id, parsed.cohortId),
          ne(cohorts.status, "confirmed"),
          ne(cohorts.status, "in_progress"),
          ne(cohorts.status, "completed"),
          ne(cohorts.status, "cancelled"),
        ),
      )
      .returning();
    if (!updated) throw new Error("แก้ได้เฉพาะรุ่นที่ยังไม่ยืนยันเปิด");
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: "cohort.update",
      entityType: "cohort",
      entityId: updated.id,
      metadata: { minimumEnrollment: parsed.minimumEnrollment, maximumEnrollment: parsed.maximumEnrollment },
    });
    return updated;
  });
}

export async function setFallbackCohortByAdmin(input: {
  cohortId: string;
  fallbackCohortId: string;
}) {
  const parsed = z.object({ cohortId: uuid, fallbackCohortId: uuid }).refine(
    (value) => value.cohortId !== value.fallbackCohortId,
    { message: "รุ่นสำรองต้องไม่ใช่รุ่นเดิม" },
  ).parse(input);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [fallback] = await tx.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.id, parsed.fallbackCohortId)).limit(1);
    if (!fallback) throw new Error("ไม่พบรุ่นสำรอง");
    const [updated] = await tx.update(cohorts).set({ fallbackCohortId: fallback.id, updatedAt: new Date() }).where(eq(cohorts.id, parsed.cohortId)).returning();
    if (!updated) throw new Error("ไม่พบรุ่นเดิม");
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "cohort.set_fallback", entityType: "cohort", entityId: updated.id, metadata: { fallbackCohortId: fallback.id } });
    return updated;
  });
}

export async function createLiveSessionByAdmin(input: {
  cohortId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  meetingProvider?: string;
  meetingUrl?: string;
}) {
  const parsed = z.object({ cohortId: uuid, title: z.string().trim().min(3).max(200), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), meetingProvider: z.string().trim().max(50).optional(), meetingUrl: z.string().url().optional() }).refine((value) => !value.endsAt || value.endsAt > value.startsAt, { message: "เวลาจบต้องอยู่หลังเวลาเริ่ม" }).parse(input);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [created] = await tx.insert(liveSessions).values(parsed).returning();
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "live_session.create", entityType: "live_session", entityId: created.id });
    return created;
  });
}

export async function createCourseMaterialByAdmin(input: {
  courseId: string;
  title: string;
  kind: "document" | "worksheet" | "link";
  externalUrl: string;
}) {
  const parsed = z.object({ courseId: uuid, title: z.string().trim().min(3).max(200), kind: z.enum(["document", "worksheet", "link"]), externalUrl: z.string().url() }).parse(input);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [created] = await tx.insert(courseMaterials).values(parsed).returning();
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "course_material.create", entityType: "course_material", entityId: created.id });
    return created;
  });
}

export async function recordAttendanceByAdmin(input: {
  enrollmentId: string;
  liveSessionId: string;
  attendancePercent: number | string;
}) {
  const parsed = z.object({ enrollmentId: uuid, liveSessionId: uuid, attendancePercent: z.coerce.number().int().min(0).max(100) }).parse(input);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .innerJoin(liveSessions, eq(liveSessions.cohortId, enrollments.cohortId))
      .where(and(eq(enrollments.id, parsed.enrollmentId), eq(liveSessions.id, parsed.liveSessionId)))
      .limit(1);
    if (!owned) throw new Error("session นี้ไม่อยู่ใน enrollment ที่เลือก");
    await tx.insert(sessionAttendance).values({ ...parsed, recordedByUserId: admin.userId, updatedAt: new Date() }).onConflictDoUpdate({ target: [sessionAttendance.enrollmentId, sessionAttendance.liveSessionId], set: { attendancePercent: parsed.attendancePercent, recordedByUserId: admin.userId, updatedAt: new Date() } });
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "attendance.record", entityType: "enrollment", entityId: parsed.enrollmentId, metadata: { liveSessionId: parsed.liveSessionId, attendancePercent: parsed.attendancePercent } });
  });
}

export async function reviewSubmissionByAdmin(input: {
  submissionId: string;
  score: number | string;
  status: "approved" | "rejected";
  feedback?: string;
}) {
  const parsed = z.object({ submissionId: uuid, score: z.coerce.number().int().min(0).max(100), status: z.enum(["approved", "rejected"]), feedback: z.string().trim().max(1000).optional() }).parse(input);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [updated] = await tx.update(submissions).set({ score: parsed.score, status: parsed.status, feedback: parsed.feedback, reviewedAt: new Date() }).where(eq(submissions.id, parsed.submissionId)).returning();
    if (!updated) throw new Error("ไม่พบงานที่ต้องการตรวจ");
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "submission.review", entityType: "submission", entityId: updated.id, metadata: { score: parsed.score, status: parsed.status } });
    return updated;
  });
}
