import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  assignments,
  auditLogs,
  cohorts,
  courses,
  enrollmentCompletions,
  enrollments,
  lessonProgress,
  lessons,
  liveSessions,
  sessionAttendance,
  submissions,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/authorization";
import {
  evaluateCompletion,
  summarizeCompletionEvidence,
} from "@/lib/domain/completion";
import { issueCertificateForCompletedEnrollment } from "@/lib/services/certificates";

const enrollmentIdSchema = z.string().uuid();

export async function refreshEnrollmentCompletion(input: {
  enrollmentId: string;
  actorUserId: string | null;
  approve: boolean;
}) {
  const enrollmentId = enrollmentIdSchema.parse(input.enrollmentId);
  const result = await getDb().transaction(async (tx) => {
    const [enrollment] = await tx
      .select({
        id: enrollments.id,
        status: enrollments.status,
        courseId: courses.id,
        cohortId: cohorts.id,
        policy: courses.completionPolicy,
        certificateEnabled: courses.certificateEnabled,
        previouslyApprovedAt: enrollmentCompletions.approvedAt,
      })
      .from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .leftJoin(
        enrollmentCompletions,
        eq(enrollmentCompletions.enrollmentId, enrollments.id),
      )
      .where(eq(enrollments.id, enrollmentId))
      .for("update", { of: enrollments })
      .limit(1);
    if (!enrollment) throw new Error("ไม่พบ enrollment ที่ต้องการคำนวณ");

    const requiredLessonRows = await tx
      .select({ progress: lessonProgress.progressPercent })
      .from(lessons)
      .leftJoin(
        lessonProgress,
        and(
          eq(lessonProgress.lessonId, lessons.id),
          eq(lessonProgress.enrollmentId, enrollmentId),
        ),
      )
      .where(and(eq(lessons.courseId, enrollment.courseId), eq(lessons.required, true)))
      .orderBy(asc(lessons.sortOrder));
    const attendanceRows = await tx
      .select({ attendance: sessionAttendance.attendancePercent })
      .from(liveSessions)
      .leftJoin(
        sessionAttendance,
        and(
          eq(sessionAttendance.liveSessionId, liveSessions.id),
          eq(sessionAttendance.enrollmentId, enrollmentId),
        ),
      )
      .where(eq(liveSessions.cohortId, enrollment.cohortId))
      .orderBy(asc(liveSessions.startsAt));
    const assignmentRows = await tx
      .select({ passingScore: assignments.passingScore, score: submissions.score })
      .from(assignments)
      .leftJoin(
        submissions,
        and(
          eq(submissions.assignmentId, assignments.id),
          eq(submissions.enrollmentId, enrollmentId),
        ),
      )
      .where(and(eq(assignments.courseId, enrollment.courseId), eq(assignments.required, true)));

    const evidence = summarizeCompletionEvidence({
      requiredLessonProgress: requiredLessonRows.map((row) => row.progress ?? 0),
      attendancePercents: attendanceRows.map((row) => row.attendance ?? 0),
      requiredAssignments: assignmentRows,
    });
    const approved = input.approve || Boolean(enrollment.previouslyApprovedAt);
    const evaluation = evaluateCompletion({
      ...evidence,
      policy: enrollment.policy,
      adminApproved: approved,
    });
    const now = new Date();
    const completedAt = evaluation.status === "completed" ? now : null;
    const approvedAt = approved ? (enrollment.previouslyApprovedAt ?? now) : null;

    await tx
      .insert(enrollmentCompletions)
      .values({
        enrollmentId,
        status: evaluation.status,
        lessonCompletionPercent: evaluation.lessonCompletionPercent,
        attendancePercent: evidence.attendancePercent,
        assignmentPassPercent: evidence.assignmentPassPercent,
        approvedByUserId: approved ? input.actorUserId : null,
        approvedAt,
        completedAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: enrollmentCompletions.enrollmentId,
        set: {
          status: evaluation.status,
          lessonCompletionPercent: evaluation.lessonCompletionPercent,
          attendancePercent: evidence.attendancePercent,
          assignmentPassPercent: evidence.assignmentPassPercent,
          approvedByUserId: approved ? input.actorUserId : null,
          approvedAt,
          completedAt,
          updatedAt: now,
        },
      });

    if (evaluation.status === "completed") {
      await tx
        .update(enrollments)
        .set({ status: "completed", completedAt: completedAt ?? now })
        .where(eq(enrollments.id, enrollmentId));
    }
    await tx.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      action: input.approve ? "completion.approve" : "completion.recalculate",
      entityType: "enrollment",
      entityId: enrollmentId,
      metadata: { ...evidence, status: evaluation.status, policy: enrollment.policy },
    });

    return {
      enrollmentId,
      status: evaluation.status,
      certificateEnabled: enrollment.certificateEnabled,
    };
  });

  if (result.status === "completed" && result.certificateEnabled) {
    await issueCertificateForCompletedEnrollment(result.enrollmentId, input.actorUserId);
  }
  return result;
}

export async function recalculateCompletionByAdmin(input: {
  enrollmentId: string;
  approve?: boolean;
}) {
  const parsed = z
    .object({ enrollmentId: enrollmentIdSchema, approve: z.boolean().optional().default(false) })
    .parse(input);
  const admin = await requireAdmin();
  return refreshEnrollmentCompletion({
    enrollmentId: parsed.enrollmentId,
    actorUserId: admin.userId,
    approve: parsed.approve,
  });
}

export async function processEnrollmentCompletions() {
  const rows = await getDb()
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.status, "active"));
  let completed = 0;
  let pendingApproval = 0;
  for (const row of rows) {
    const result = await refreshEnrollmentCompletion({
      enrollmentId: row.id,
      actorUserId: null,
      approve: false,
    });
    if (result.status === "completed") completed += 1;
    if (result.status === "pending_approval") pendingApproval += 1;
  }
  return { scanned: rows.length, completed, pendingApproval };
}
