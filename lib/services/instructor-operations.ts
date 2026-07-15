import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  enrollments,
  liveSessions,
  sessionAttendance,
  submissions,
} from "@/db/schema";
import { requireCohortInstructor } from "@/lib/auth/authorization";
import { normalizeAttendanceBatch } from "@/lib/domain/instructor";
import { parseBangkokDateTime } from "@/lib/domain/datetime";

const uuid = z.string().uuid();
const bangkokDateTime = z.string().transform((value, context) => {
  try {
    return parseBangkokDateTime(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "วันเวลาไม่ถูกต้อง",
    });
    return z.NEVER;
  }
});

export async function scheduleAssignedSession(input: {
  cohortId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  meetingProvider?: string;
  meetingUrl?: string;
}) {
  const parsed = z
    .object({
      cohortId: uuid,
      title: z.string().trim().min(3).max(200),
      startsAt: bangkokDateTime,
      endsAt: bangkokDateTime.optional(),
      meetingProvider: z.string().trim().max(50).optional(),
      meetingUrl: z.string().url().optional(),
    })
    .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
      message: "เวลาจบต้องอยู่หลังเวลาเริ่ม",
    })
    .parse(input);
  const instructor = await requireCohortInstructor(parsed.cohortId);
  return getDb().transaction(async (tx) => {
    const [created] = await tx.insert(liveSessions).values(parsed).returning();
    await tx.insert(auditLogs).values({
      actorUserId: instructor.userId,
      action: "instructor.live_session.create",
      entityType: "live_session",
      entityId: created.id,
      metadata: { cohortId: parsed.cohortId },
    });
    return created;
  });
}

export async function recordBatchAttendance(input: {
  cohortId: string;
  liveSessionId: string;
  rows: Array<{ enrollmentId: string; attendancePercent: number }>;
}) {
  const cohortId = uuid.parse(input.cohortId);
  const liveSessionId = uuid.parse(input.liveSessionId);
  const rows = normalizeAttendanceBatch(input.rows);
  if (!rows.length) throw new Error("กรุณาเลือกผู้เรียนอย่างน้อย 1 คน");
  rows.forEach((row) => uuid.parse(row.enrollmentId));
  const instructor = await requireCohortInstructor(cohortId);

  return getDb().transaction(async (tx) => {
    const [session] = await tx
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(and(eq(liveSessions.id, liveSessionId), eq(liveSessions.cohortId, cohortId)))
      .limit(1);
    if (!session) throw new Error("session นี้ไม่อยู่ในรุ่นที่เลือก");
    const cohortEnrollments = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.cohortId, cohortId),
          inArray(enrollments.id, rows.map((row) => row.enrollmentId)),
        ),
      );
    if (cohortEnrollments.length !== rows.length) {
      throw new Error("พบผู้เรียนที่ไม่อยู่ในรุ่นที่ได้รับมอบหมาย");
    }
    for (const row of rows) {
      await tx
        .insert(sessionAttendance)
        .values({
          ...row,
          liveSessionId,
          recordedByUserId: instructor.userId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [sessionAttendance.enrollmentId, sessionAttendance.liveSessionId],
          set: {
            attendancePercent: row.attendancePercent,
            recordedByUserId: instructor.userId,
            updatedAt: new Date(),
          },
        });
    }
    await tx.insert(auditLogs).values({
      actorUserId: instructor.userId,
      action: "instructor.attendance.batch_record",
      entityType: "live_session",
      entityId: liveSessionId,
      metadata: { cohortId, count: rows.length },
    });
    return { count: rows.length };
  });
}

export async function reviewAssignedSubmission(input: {
  submissionId: string;
  score: number | string;
  status: "approved" | "rejected";
  feedback?: string;
}) {
  const parsed = z
    .object({
      submissionId: uuid,
      score: z.coerce.number().int().min(0).max(100),
      status: z.enum(["approved", "rejected"]),
      feedback: z.string().trim().max(2000).optional(),
    })
    .parse(input);
  const [owned] = await getDb()
    .select({ cohortId: enrollments.cohortId })
    .from(submissions)
    .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
    .where(eq(submissions.id, parsed.submissionId))
    .limit(1);
  if (!owned) throw new Error("ไม่พบงานที่ต้องการตรวจ");
  const instructor = await requireCohortInstructor(owned.cohortId);

  return getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(submissions)
      .set({
        score: parsed.score,
        status: parsed.status,
        feedback: parsed.feedback,
        reviewedAt: new Date(),
      })
      .where(eq(submissions.id, parsed.submissionId))
      .returning();
    if (!updated) throw new Error("ไม่พบงานที่ต้องการตรวจ");
    await tx.insert(auditLogs).values({
      actorUserId: instructor.userId,
      action: "instructor.submission.review",
      entityType: "submission",
      entityId: updated.id,
      metadata: { cohortId: owned.cohortId, score: parsed.score, status: parsed.status },
    });
    return updated;
  });
}
