import { asc, count, eq, sql } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import {
  cohortInstructors,
  cohorts,
  courses,
  enrollmentCompletions,
  enrollments,
  liveSessions,
  submissions,
} from "@/db/schema";
import { canUseDemoData } from "./demo-policy";

export type InstructorDashboard = {
  instructorName: string;
  nextSession: {
    cohortId: string;
    courseTitle: string;
    cohortTitle: string;
    startsAt: Date;
    endsAt: Date;
    learnerCount: number;
    meetingUrl: string | null;
    coverUrl: string;
  } | null;
  queue: Array<{
    kind: "grading" | "qna" | "attendance" | "risk";
    label: string;
    detail: string;
    href: string;
  }>;
  cohorts: Array<{
    id: string;
    courseId: string;
    title: string;
    learnerCount: number;
    progressPercent: number;
    completedModules: number;
    totalModules: number;
    nextSessionAt: Date;
    coverUrl: string;
  }>;
};

const demoDashboard: InstructorDashboard = {
  instructorName: "กาญจนา",
  nextSession: {
    cohortId: "00000000-0000-4000-8000-000000000103",
    courseTitle: "AI Fundamentals รุ่นกรกฎาคม",
    cohortTitle: "คลาสสด",
    startsAt: new Date("2026-07-15T12:00:00.000Z"),
    endsAt: new Date("2026-07-15T14:00:00.000Z"),
    learnerCount: 48,
    meetingUrl: "https://meet.google.com/",
    coverUrl: "/images/course-ai-fundamentals.webp",
  },
  queue: [
    { kind: "grading", label: "งานรอตรวจ", detail: "8 ชิ้น", href: "/teach#grading" },
    { kind: "qna", label: "Q&A ยังไม่มีคำตอบ", detail: "3 กระทู้", href: "/teach#qna" },
    { kind: "attendance", label: "Attendance ยังไม่ครบ", detail: "1 session", href: "/teach#attendance" },
    { kind: "risk", label: "ผู้เรียนควรได้รับความช่วยเหลือ", detail: "4 คน", href: "/teach#learners" },
  ],
  cohorts: [
    {
      id: "00000000-0000-4000-8000-000000000103",
      courseId: "00000000-0000-4000-8000-000000000001",
      title: "AI Fundamentals รุ่นกรกฎาคม",
      learnerCount: 48,
      progressPercent: 38,
      completedModules: 3,
      totalModules: 8,
      nextSessionAt: new Date("2026-07-15T12:00:00.000Z"),
      coverUrl: "/images/course-ai-fundamentals.webp",
    },
    {
      id: "00000000-0000-4000-8000-000000000104",
      courseId: "00000000-0000-4000-8000-000000000002",
      title: "ChatGPT และ Claude สำหรับงานเขียน",
      learnerCount: 36,
      progressPercent: 33,
      completedModules: 2,
      totalModules: 6,
      nextSessionAt: new Date("2026-07-17T12:00:00.000Z"),
      coverUrl: "/images/beginner-path.webp",
    },
    {
      id: "00000000-0000-4000-8000-000000000105",
      courseId: "00000000-0000-4000-8000-000000000003",
      title: "Gemini สำหรับ Google Workspace",
      learnerCount: 41,
      progressPercent: 20,
      completedModules: 1,
      totalModules: 5,
      nextSessionAt: new Date("2026-07-20T12:00:00.000Z"),
      coverUrl: "/images/course-data-analysis.webp",
    },
    {
      id: "00000000-0000-4000-8000-000000000106",
      courseId: "00000000-0000-4000-8000-000000000004",
      title: "AI วิเคราะห์ข้อมูลสำหรับธุรกิจ",
      learnerCount: 29,
      progressPercent: 57,
      completedModules: 4,
      totalModules: 7,
      nextSessionAt: new Date("2026-07-22T12:00:00.000Z"),
      coverUrl: "/images/course-data-analysis.webp",
    },
  ],
};

export async function getInstructorDashboard(
  userId: string,
  displayName: string,
  demo = false,
): Promise<InstructorDashboard> {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return { ...demoDashboard, instructorName: displayName === "ทีม AI เริ่มได้" ? "กาญจนา" : displayName };
  }
  if (!hasDatabaseConnection()) {
    return { instructorName: displayName, nextSession: null, queue: [], cohorts: [] };
  }

  const db = getDb();
  const assigned = await db
    .select({
      id: cohorts.id,
      courseId: courses.id,
      title: cohorts.title,
      courseTitle: courses.title,
      coverUrl: courses.coverUrl,
      startsAt: cohorts.startsAt,
    })
    .from(cohortInstructors)
    .innerJoin(cohorts, eq(cohorts.id, cohortInstructors.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(cohortInstructors.userId, userId))
    .orderBy(asc(cohorts.startsAt));

  const cohortRows = await Promise.all(
    assigned.map(async (cohort) => {
      const [[stats], [nextSession], [grading]] = await Promise.all([
        db
          .select({
            learnerCount: count(enrollments.id),
            progressPercent: sql<number>`coalesce(avg(${enrollmentCompletions.lessonCompletionPercent}), 0)`,
          })
          .from(enrollments)
          .leftJoin(
            enrollmentCompletions,
            eq(enrollmentCompletions.enrollmentId, enrollments.id),
          )
          .where(eq(enrollments.cohortId, cohort.id)),
        db
          .select({
            startsAt: liveSessions.startsAt,
            endsAt: liveSessions.endsAt,
            meetingUrl: liveSessions.meetingUrl,
          })
          .from(liveSessions)
          .where(eq(liveSessions.cohortId, cohort.id))
          .orderBy(asc(liveSessions.startsAt))
          .limit(1),
        db
          .select({ pending: count(submissions.id) })
          .from(submissions)
          .innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId))
          .where(eq(enrollments.cohortId, cohort.id)),
      ]);
      return {
        id: cohort.id,
        courseId: cohort.courseId,
        courseTitle: cohort.courseTitle,
        title: cohort.title,
        learnerCount: Number(stats?.learnerCount ?? 0),
        progressPercent: Math.round(Number(stats?.progressPercent ?? 0)),
        completedModules: 0,
        totalModules: 0,
        nextSessionAt: nextSession?.startsAt ?? cohort.startsAt,
        nextSessionEndsAt: nextSession?.endsAt ?? cohort.startsAt,
        meetingUrl: nextSession?.meetingUrl ?? null,
        coverUrl: cohort.coverUrl ?? "/images/course-ai-fundamentals.webp",
        gradingCount: Number(grading?.pending ?? 0),
      };
    }),
  );

  const first = cohortRows[0];
  const gradingCount = cohortRows.reduce((sum, cohort) => sum + cohort.gradingCount, 0);
  return {
    instructorName: displayName,
    nextSession: first
      ? {
          cohortId: first.id,
          courseTitle: first.courseTitle,
          cohortTitle: first.title,
          startsAt: first.nextSessionAt,
          endsAt: first.nextSessionEndsAt,
          learnerCount: first.learnerCount,
          meetingUrl: first.meetingUrl,
          coverUrl: first.coverUrl,
        }
      : null,
    queue: gradingCount
      ? [{ kind: "grading", label: "งานรอตรวจ", detail: `${gradingCount} ชิ้น`, href: "/teach#grading" }]
      : [],
    cohorts: cohortRows.map((cohort) => ({
      id: cohort.id,
      courseId: cohort.courseId,
      title: cohort.title,
      learnerCount: cohort.learnerCount,
      progressPercent: cohort.progressPercent,
      completedModules: cohort.completedModules,
      totalModules: cohort.totalModules,
      nextSessionAt: cohort.nextSessionAt,
      coverUrl: cohort.coverUrl,
    })),
  };
}
