import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  assignments,
  auditLogs,
  cohorts,
  enrollments,
  lessonProgress,
  lessons,
  submissions,
} from "@/db/schema";
import { requireMember } from "@/lib/auth/authorization";
import { refreshEnrollmentCompletion } from "@/lib/services/completions";

const uuid = z.string().uuid();

export async function updateLessonProgressForMember(input: {
  enrollmentId: string;
  lessonId: string;
  progressPercent: number | string;
}) {
  const parsed = z.object({
    enrollmentId: uuid,
    lessonId: uuid,
    progressPercent: z.coerce.number().int().min(0).max(100),
  }).parse(input);
  const member = await requireMember();

  await getDb().transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(lessons, eq(lessons.courseId, cohorts.courseId))
      .where(and(
        eq(enrollments.id, parsed.enrollmentId),
        eq(enrollments.userId, member.userId),
        eq(enrollments.status, "active"),
        eq(lessons.id, parsed.lessonId),
      ))
      .limit(1);
    if (!owned) throw new Error("บทเรียนนี้ไม่อยู่ใน enrollment ของคุณ");

    const now = new Date();
    await tx.insert(lessonProgress).values({
      enrollmentId: parsed.enrollmentId,
      lessonId: parsed.lessonId,
      progressPercent: parsed.progressPercent,
      completedAt: parsed.progressPercent === 100 ? now : null,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [lessonProgress.enrollmentId, lessonProgress.lessonId],
      set: {
        progressPercent: parsed.progressPercent,
        completedAt: parsed.progressPercent === 100 ? now : null,
        updatedAt: now,
      },
    });
    await tx.insert(auditLogs).values({
      actorUserId: member.userId,
      action: "lesson_progress.update",
      entityType: "enrollment",
      entityId: parsed.enrollmentId,
      metadata: { lessonId: parsed.lessonId, progressPercent: parsed.progressPercent },
    });
  });

  return refreshEnrollmentCompletion({
    enrollmentId: parsed.enrollmentId,
    actorUserId: member.userId,
    approve: false,
  });
}

export async function submitAssignmentForMember(input: {
  enrollmentId: string;
  assignmentId: string;
  submissionUrl: string;
}) {
  const parsed = z.object({
    enrollmentId: uuid,
    assignmentId: uuid,
    submissionUrl: z.string().url().refine(
      (value) => ["http:", "https:"].includes(new URL(value).protocol),
      "ลิงก์งานต้องเป็น http หรือ https",
    ),
  }).parse(input);
  const member = await requireMember();

  await getDb().transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(assignments, eq(assignments.courseId, cohorts.courseId))
      .where(and(
        eq(enrollments.id, parsed.enrollmentId),
        eq(enrollments.userId, member.userId),
        eq(enrollments.status, "active"),
        eq(assignments.id, parsed.assignmentId),
      ))
      .limit(1);
    if (!owned) throw new Error("งานนี้ไม่อยู่ใน enrollment ของคุณ");

    const now = new Date();
    await tx.insert(submissions).values({
      enrollmentId: parsed.enrollmentId,
      assignmentId: parsed.assignmentId,
      submissionUrl: parsed.submissionUrl,
      status: "submitted",
      submittedAt: now,
    }).onConflictDoUpdate({
      target: [submissions.assignmentId, submissions.enrollmentId],
      set: {
        submissionUrl: parsed.submissionUrl,
        status: "submitted",
        score: null,
        feedback: null,
        submittedAt: now,
        reviewedAt: null,
      },
    });
    await tx.insert(auditLogs).values({
      actorUserId: member.userId,
      action: "submission.submit",
      entityType: "enrollment",
      entityId: parsed.enrollmentId,
      metadata: { assignmentId: parsed.assignmentId },
    });
  });

  return refreshEnrollmentCompletion({
    enrollmentId: parsed.enrollmentId,
    actorUserId: member.userId,
    approve: false,
  });
}

