import { and, asc, eq } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import {
  assignments,
  cohortInstructors,
  cohorts,
  courses,
  enrollmentCompletions,
  enrollments,
  liveSessions,
  profiles,
  submissions,
} from "@/db/schema";
import { learnerRiskLevel } from "@/lib/domain/instructor";
import { canUseDemoData } from "./demo-policy";

export type InstructorCohortWorkspace = {
  id: string;
  title: string;
  courseTitle: string;
  sessions: Array<{ id: string; title: string; startsAt: Date; endsAt: Date | null; meetingUrl: string | null }>;
  roster: Array<{ enrollmentId: string; learnerName: string; progressPercent: number; attendancePercent: number; risk: "low" | "medium" | "high" }>;
  submissions: Array<{ id: string; learnerName: string; assignmentTitle: string; status: string; score: number | null }>;
};

const demoWorkspace: InstructorCohortWorkspace = {
  id: "00000000-0000-4000-8000-000000000103",
  title: "รุ่นกรกฎาคม 2569",
  courseTitle: "AI Fundamentals",
  sessions: [{ id: "00000000-0000-4000-8000-000000000301", title: "Session 4 · ตรวจคำตอบ AI", startsAt: new Date("2026-07-15T12:00:00.000Z"), endsAt: new Date("2026-07-15T14:00:00.000Z"), meetingUrl: "https://meet.google.com/" }],
  roster: [
    { enrollmentId: "00000000-0000-4000-8000-000000000201", learnerName: "ชลิตา วงศ์ดี", progressPercent: 18, attendancePercent: 60, risk: "high" },
    { enrollmentId: "00000000-0000-4000-8000-000000000202", learnerName: "พีรภัทร ใจดี", progressPercent: 56, attendancePercent: 86, risk: "medium" },
    { enrollmentId: "00000000-0000-4000-8000-000000000203", learnerName: "นลินี ตั้งใจ", progressPercent: 82, attendancePercent: 96, risk: "low" },
  ],
  submissions: [{ id: "00000000-0000-4000-8000-000000000401", learnerName: "ชลิตา วงศ์ดี", assignmentTitle: "Workflow ที่นำไปใช้จริง", status: "submitted", score: null }],
};

export async function getInstructorCohortWorkspace(
  cohortId: string,
  userId: string,
  demo = false,
): Promise<InstructorCohortWorkspace | null> {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) return { ...demoWorkspace, id: cohortId };
  if (!hasDatabaseConnection()) return null;
  const db = getDb();
  const [cohort] = await db.select({ id: cohorts.id, title: cohorts.title, courseTitle: courses.title }).from(cohortInstructors).innerJoin(cohorts, eq(cohorts.id, cohortInstructors.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(and(eq(cohortInstructors.cohortId, cohortId), eq(cohortInstructors.userId, userId))).limit(1);
  if (!cohort) return null;
  const [sessionRows, rosterRows, submissionRows] = await Promise.all([
    db.select({ id: liveSessions.id, title: liveSessions.title, startsAt: liveSessions.startsAt, endsAt: liveSessions.endsAt, meetingUrl: liveSessions.meetingUrl }).from(liveSessions).where(eq(liveSessions.cohortId, cohortId)).orderBy(asc(liveSessions.startsAt)),
    db.select({ enrollmentId: enrollments.id, learnerName: profiles.displayName, progressPercent: enrollmentCompletions.lessonCompletionPercent, attendancePercent: enrollmentCompletions.attendancePercent }).from(enrollments).innerJoin(profiles, eq(profiles.userId, enrollments.userId)).leftJoin(enrollmentCompletions, eq(enrollmentCompletions.enrollmentId, enrollments.id)).where(eq(enrollments.cohortId, cohortId)).orderBy(asc(profiles.displayName)),
    db.select({ id: submissions.id, learnerName: profiles.displayName, assignmentTitle: assignments.title, status: submissions.status, score: submissions.score }).from(submissions).innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId)).innerJoin(profiles, eq(profiles.userId, enrollments.userId)).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(eq(enrollments.cohortId, cohortId)).orderBy(asc(profiles.displayName)),
  ]);
  return {
    ...cohort,
    sessions: sessionRows,
    roster: rosterRows.map((row) => {
      const progressPercent = row.progressPercent ?? 0;
      const attendancePercent = row.attendancePercent ?? 0;
      return { ...row, progressPercent, attendancePercent, risk: learnerRiskLevel({ progressPercent, attendancePercent, overdueAssignments: 0 }) };
    }),
    submissions: submissionRows,
  };
}
