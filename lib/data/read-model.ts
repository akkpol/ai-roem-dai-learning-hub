import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import {
  assignments,
  certificates,
  cohorts,
  courseInstructors,
  courseInvites,
  courseMaterials,
  courses as courseTable,
  enrollmentCompletions,
  enrollments,
  instructors,
  lessonProgress,
  lessons,
  liveSessions,
  productEvents,
  profiles,
  seatReservations,
  submissions,
  videoAccessGrants,
} from "@/db/schema";
import { calculateBetaScorecard } from "@/lib/analytics/kpis";
import { courses as demoCatalog, type Course } from "@/lib/catalog";
import { canUseDemoData } from "@/lib/data/demo-policy";

export type CohortCard = {
  id: string;
  title: string;
  status:
    | "draft"
    | "collecting"
    | "threshold_met"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "postponed"
    | "cancelled";
  startsAt: Date;
  registrationOpensAt: Date;
  registrationDeadlineAt: Date;
  minimumEnrollment: number;
  maximumEnrollment: number;
  activeReservations: number;
  waitlistedReservations: number;
  fallbackCohortId: string | null;
  overrideReason: string | null;
};

export type CourseDetail = Course & {
  summary: string;
  outcomes: string[];
  cohort: CohortCard | null;
};

const demoCohorts: CohortCard[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    title: "AI Fundamentals รุ่นกรกฎาคม",
    status: "collecting",
    startsAt: new Date("2026-07-27T12:00:00.000Z"),
    registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
    registrationDeadlineAt: new Date("2026-07-20T12:00:00.000Z"),
    minimumEnrollment: 8,
    maximumEnrollment: 16,
    activeReservations: 4,
    waitlistedReservations: 0,
    fallbackCohortId: "00000000-0000-4000-8000-000000000102",
    overrideReason: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    title: "Gemini Workspace รุ่นสิงหาคม",
    status: "threshold_met",
    startsAt: new Date("2026-08-03T12:00:00.000Z"),
    registrationOpensAt: new Date("2026-07-08T00:00:00.000Z"),
    registrationDeadlineAt: new Date("2026-07-27T12:00:00.000Z"),
    minimumEnrollment: 8,
    maximumEnrollment: 16,
    activeReservations: 8,
    waitlistedReservations: 1,
    fallbackCohortId: null,
    overrideReason: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    title: "AI วิเคราะห์ข้อมูล รุ่นกรกฎาคม",
    status: "confirmed",
    startsAt: new Date("2026-07-22T12:00:00.000Z"),
    registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
    registrationDeadlineAt: new Date("2026-07-15T12:00:00.000Z"),
    minimumEnrollment: 10,
    maximumEnrollment: 20,
    activeReservations: 12,
    waitlistedReservations: 0,
    fallbackCohortId: null,
    overrideReason: null,
  },
];

function demoCourseDetail(slug: string): CourseDetail | null {
  const course = demoCatalog.find((item) => item.id === slug);
  if (!course) return null;
  const cohort =
    slug === "ai-fundamentals"
      ? demoCohorts[0]
      : slug === "gemini-workspace"
        ? demoCohorts[1]
        : slug === "ai-data-business"
          ? demoCohorts[2]
          : null;

  return {
    ...course,
    summary:
      "คลาสขนาดเล็กที่พาเรียนจากแนวคิดไปสู่การลงมือทำจริง พร้อมตัวอย่างภาษาไทยและพื้นที่ถามตอบกับผู้สอน",
    outcomes: [
      "เลือกใช้เครื่องมือ AI ให้เหมาะกับงานและข้อจำกัด",
      "เขียนคำสั่งที่ชัดเจนและตรวจคำตอบอย่างเป็นระบบ",
      "นำ workflow ที่เรียนไปปรับใช้กับงานจริงได้ทันที",
    ],
    cohort,
  };
}

function thaiLevel(level: "beginner" | "applied" | "expert") {
  return level === "beginner" ? "เริ่มต้น" : level === "applied" ? "ประยุกต์ใช้" : "เชี่ยวชาญ";
}

export async function getCourseDetail(slug: string): Promise<CourseDetail | null> {
  if (!hasDatabaseConnection()) return demoCourseDetail(slug);

  const db = getDb();
  const [course] = await db
    .select()
    .from(courseTable)
    .where(and(eq(courseTable.slug, slug), eq(courseTable.status, "published")))
    .limit(1);
  if (!course) return null;

  const [instructor] = await db
    .select({ name: instructors.name, avatarUrl: instructors.avatarUrl })
    .from(courseInstructors)
    .innerJoin(instructors, eq(instructors.id, courseInstructors.instructorId))
    .where(eq(courseInstructors.courseId, course.id))
    .limit(1);
  const [cohort] = await db
    .select()
    .from(cohorts)
    .where(
      and(
        eq(cohorts.courseId, course.id),
        inArray(cohorts.status, ["collecting", "threshold_met", "confirmed", "postponed"]),
      ),
    )
    .orderBy(asc(cohorts.startsAt))
    .limit(1);

  let cohortCard: CohortCard | null = null;
  if (cohort) {
    const [counts] = await db
      .select({
        active: sql<number>`count(*) filter (where ${seatReservations.status} = 'active')`,
        waitlisted: sql<number>`count(*) filter (where ${seatReservations.status} = 'waitlisted')`,
      })
      .from(seatReservations)
      .where(eq(seatReservations.cohortId, cohort.id));
    cohortCard = {
      id: cohort.id,
      title: cohort.title,
      status: cohort.status,
      startsAt: cohort.startsAt,
      registrationOpensAt: cohort.registrationOpensAt,
      registrationDeadlineAt: cohort.registrationDeadlineAt,
      minimumEnrollment: cohort.minimumEnrollment,
      maximumEnrollment: cohort.maximumEnrollment,
      activeReservations: Number(counts?.active ?? 0),
      waitlistedReservations: Number(counts?.waitlisted ?? 0),
      fallbackCohortId: cohort.fallbackCohortId,
      overrideReason: cohort.overrideReason,
    };
  }

  return {
    id: course.slug,
    title: course.title,
    level: thaiLevel(course.level),
    tools: ["อื่น ๆ"],
    fields: ["ธุรกิจ"],
    format: cohort ? "คลาสสด" : "วิดีโอย้อนหลัง",
    duration: `${Math.round(course.durationMinutes / 60)} ชั่วโมง`,
    instructor: instructor?.name ?? "ทีม AI เริ่มได้",
    avatar: instructor?.avatarUrl ?? "/images/avatar-natthapong.webp",
    availability: cohort ? `เริ่ม ${cohort.startsAt.toLocaleDateString("th-TH")}` : "เรียนได้ทันที",
    certificate: course.certificateEnabled,
    cover: "fundamentals",
    summary: course.summary,
    outcomes: ["เข้าใจหลักการ", "ลงมือทำกับโจทย์จริง", "นำไปใช้ต่อได้อย่างปลอดภัย"],
    cohort: cohortCard,
  };
}

export type EnrollmentSummary = {
  id: string;
  courseTitle: string;
  cohortTitle: string;
  status: string;
  startsAt: Date;
  progressPercent: number;
  nextSessionAt: Date | null;
};

export type ReservationSummary = {
  id: string;
  courseSlug: string;
  courseTitle: string;
  cohortId: string;
  cohortTitle: string;
  cohortStatus: CohortCard["status"];
  reservationStatus: "active" | "waitlisted" | "expired";
  startsAt: Date;
  hasFallback: boolean;
};

export async function getLearnerReservations(
  userId: string,
  demo = false,
): Promise<ReservationSummary[]> {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) return [];
  if (!hasDatabaseConnection()) return [];

  return getDb()
    .select({
      id: seatReservations.id,
      courseSlug: courseTable.slug,
      courseTitle: courseTable.title,
      cohortId: cohorts.id,
      cohortTitle: cohorts.title,
      cohortStatus: cohorts.status,
      reservationStatus: seatReservations.status,
      startsAt: cohorts.startsAt,
      fallbackCohortId: cohorts.fallbackCohortId,
    })
    .from(seatReservations)
    .innerJoin(cohorts, eq(cohorts.id, seatReservations.cohortId))
    .innerJoin(courseTable, eq(courseTable.id, cohorts.courseId))
    .where(
      and(
        eq(seatReservations.userId, userId),
        inArray(seatReservations.status, ["active", "waitlisted", "expired"]),
        inArray(cohorts.status, ["collecting", "threshold_met", "postponed"]),
      ),
    )
    .orderBy(asc(cohorts.startsAt))
    .then((rows) =>
      rows.map((row) => ({
        id: row.id,
        courseSlug: row.courseSlug,
        courseTitle: row.courseTitle,
        cohortId: row.cohortId,
        cohortTitle: row.cohortTitle,
        cohortStatus: row.cohortStatus,
        reservationStatus: row.reservationStatus as ReservationSummary["reservationStatus"],
        startsAt: row.startsAt,
        hasFallback: Boolean(row.fallbackCohortId),
      })),
    );
}

const demoEnrollment: EnrollmentSummary = {
  id: "00000000-0000-4000-8000-000000000201",
  courseTitle: "AI วิเคราะห์ข้อมูลสำหรับธุรกิจ",
  cohortTitle: "รุ่นกรกฎาคม",
  status: "active",
  startsAt: new Date("2026-07-22T12:00:00.000Z"),
  progressPercent: 62,
  nextSessionAt: new Date("2026-07-22T12:00:00.000Z"),
};

export async function getLearnerEnrollments(userId: string, demo = false) {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return [demoEnrollment];
  }
  if (!hasDatabaseConnection()) return [];

  const rows = await getDb()
    .select({
      id: enrollments.id,
      courseTitle: courseTable.title,
      cohortTitle: cohorts.title,
      status: enrollments.status,
      startsAt: cohorts.startsAt,
      completionPercent: enrollmentCompletions.lessonCompletionPercent,
    })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courseTable, eq(courseTable.id, cohorts.courseId))
    .leftJoin(enrollmentCompletions, eq(enrollmentCompletions.enrollmentId, enrollments.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(cohorts.startsAt));

  return rows.map((row) => ({
    id: row.id,
    courseTitle: row.courseTitle,
    cohortTitle: row.cohortTitle,
    status: row.status,
    startsAt: row.startsAt,
    progressPercent: row.completionPercent ?? 0,
    nextSessionAt: row.startsAt,
  } satisfies EnrollmentSummary));
}

export type EnrollmentDetail = EnrollmentSummary & {
  meetingProvider: string | null;
  meetingUrl: string | null;
  lessons: Array<{
    id: string;
    title: string;
    kind: string;
    progressPercent: number;
    recordingUrl: string | null;
  }>;
  materials: Array<{ id: string; title: string; kind: string }>;
  attendancePercent: number;
  assignmentPassPercent: number;
  completionStatus: string;
};

const demoEnrollmentDetail: EnrollmentDetail = {
  ...demoEnrollment,
  meetingProvider: "Google Meet",
  meetingUrl: "https://meet.google.com/lookup/ai-roem-dai-demo",
  lessons: [
    { id: "l1", title: "วางโจทย์ธุรกิจให้ AI เข้าใจ", kind: "live", progressPercent: 100, recordingUrl: null },
    { id: "l2", title: "เตรียมข้อมูลและตรวจคุณภาพ", kind: "workshop", progressPercent: 100, recordingUrl: null },
    {
      id: "l3",
      title: "สรุป insight และนำเสนอผล",
      kind: "video",
      progressPercent: 40,
      recordingUrl: "https://www.youtube.com/",
    },
  ],
  materials: [
    { id: "m1", title: "Workbook วิเคราะห์ข้อมูล", kind: "worksheet" },
    { id: "m2", title: "Checklist ตรวจคำตอบ AI", kind: "document" },
  ],
  attendancePercent: 82,
  assignmentPassPercent: 75,
  completionStatus: "in_progress",
};

export async function getEnrollmentDetail(
  enrollmentId: string,
  userId: string,
  isAdmin = false,
  demo = false,
): Promise<EnrollmentDetail | null> {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return enrollmentId === demoEnrollment.id ? demoEnrollmentDetail : null;
  }
  if (!hasDatabaseConnection()) return null;

  const db = getDb();
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      userId: enrollments.userId,
      status: enrollments.status,
      courseId: courseTable.id,
      courseTitle: courseTable.title,
      cohortId: cohorts.id,
      cohortTitle: cohorts.title,
      cohortStatus: cohorts.status,
      startsAt: cohorts.startsAt,
      progressPercent: enrollmentCompletions.lessonCompletionPercent,
      attendancePercent: enrollmentCompletions.attendancePercent,
      assignmentPassPercent: enrollmentCompletions.assignmentPassPercent,
      completionStatus: enrollmentCompletions.status,
    })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courseTable, eq(courseTable.id, cohorts.courseId))
    .leftJoin(enrollmentCompletions, eq(enrollmentCompletions.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.id, enrollmentId),
        isAdmin ? undefined : eq(enrollments.userId, userId),
      ),
    )
    .limit(1);
  if (!enrollment) return null;

  const lessonRows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      kind: lessons.kind,
      progressPercent: lessonProgress.progressPercent,
      recordingUrl: videoAccessGrants.youtubeUrl,
    })
    .from(lessons)
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.enrollmentId, enrollmentId),
      ),
    )
    .leftJoin(
      videoAccessGrants,
      and(
        eq(videoAccessGrants.lessonId, lessons.id),
        eq(videoAccessGrants.enrollmentId, enrollmentId),
        isNull(videoAccessGrants.revokedAt),
      ),
    )
    .where(eq(lessons.courseId, enrollment.courseId))
    .orderBy(asc(lessons.sortOrder));
  const materialRows = await db
    .select({ id: courseMaterials.id, title: courseMaterials.title, kind: courseMaterials.kind })
    .from(courseMaterials)
    .where(eq(courseMaterials.courseId, enrollment.courseId));
  const [session] = await db
    .select({
      provider: liveSessions.meetingProvider,
      url: liveSessions.meetingUrl,
      startsAt: liveSessions.startsAt,
    })
    .from(liveSessions)
    .where(eq(liveSessions.cohortId, enrollment.cohortId))
    .orderBy(asc(liveSessions.startsAt))
    .limit(1);
  const canAccessMeeting = ["confirmed", "in_progress", "completed"].includes(
    enrollment.cohortStatus,
  );

  return {
    id: enrollment.id,
    courseTitle: enrollment.courseTitle,
    cohortTitle: enrollment.cohortTitle,
    status: enrollment.status,
    startsAt: enrollment.startsAt,
    progressPercent: enrollment.progressPercent ?? 0,
    nextSessionAt: session?.startsAt ?? null,
    meetingProvider: canAccessMeeting ? (session?.provider ?? null) : null,
    meetingUrl: canAccessMeeting ? (session?.url ?? null) : null,
    lessons: lessonRows.map((lesson) => ({
      ...lesson,
      progressPercent: lesson.progressPercent ?? 0,
      recordingUrl: lesson.recordingUrl ?? null,
    })),
    materials: materialRows,
    attendancePercent: enrollment.attendancePercent ?? 0,
    assignmentPassPercent: enrollment.assignmentPassPercent ?? 0,
    completionStatus: enrollment.completionStatus ?? "in_progress",
  };
}

export type CertificateView = {
  id: string;
  certificateCode: string;
  shareSlug: string;
  learnerName: string;
  courseTitle: string;
  instructorName: string;
  completedAt: Date;
  issuedAt: Date;
  templateVersion: string;
  publicVerificationEnabled: boolean;
  revokedAt: Date | null;
};

export const demoCertificate: CertificateView = {
  id: "demo-certificate",
  certificateCode: "ARD-2569-0001",
  shareSlug: "akkapol-ai-2569",
  learnerName: "กาญจนา ตั้งใจเรียน",
  courseTitle: "AI Fundamentals: เริ่มต้นอย่างเข้าใจและปลอดภัย",
  instructorName: "ดร. ณัฐพงศ์ วงศ์ไอที",
  completedAt: new Date("2026-07-12T00:00:00.000Z"),
  issuedAt: new Date("2026-07-13T00:00:00.000Z"),
  templateVersion: "beta-v1",
  publicVerificationEnabled: true,
  revokedAt: null,
};

function mapCertificate(row: typeof certificates.$inferSelect): CertificateView {
  return {
    id: row.id,
    certificateCode: row.certificateCode,
    shareSlug: row.shareSlug,
    learnerName: row.learnerNameSnapshot,
    courseTitle: row.courseTitleSnapshot,
    instructorName: row.instructorNameSnapshot,
    completedAt: row.completedAtSnapshot,
    issuedAt: row.issuedAt,
    templateVersion: row.templateVersion,
    publicVerificationEnabled: row.publicVerificationEnabled,
    revokedAt: row.revokedAt,
  };
}

export async function getMemberCertificates(userId: string, demo = false) {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return [demoCertificate];
  }
  if (!hasDatabaseConnection()) return [];
  const rows = await getDb()
    .select({ certificate: certificates })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(certificates.issuedAt));
  return rows.map((row) => mapCertificate(row.certificate));
}

export async function getPublicCertificate(shareSlug: string) {
  if (!hasDatabaseConnection()) {
    return canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: true }) &&
      shareSlug === demoCertificate.shareSlug
      ? demoCertificate
      : null;
  }
  const [row] = await getDb()
    .select()
    .from(certificates)
    .where(
      and(
        eq(certificates.shareSlug, shareSlug),
        eq(certificates.publicVerificationEnabled, true),
        isNull(certificates.revokedAt),
      ),
    )
    .limit(1);
  return row ? mapCertificate(row) : null;
}

export async function getCertificateById(id: string, userId: string, isAdmin = false) {
  if (!hasDatabaseConnection()) {
    return canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: true }) &&
      id === demoCertificate.id
      ? demoCertificate
      : null;
  }
  const [row] = await getDb()
    .select({ certificate: certificates, ownerUserId: enrollments.userId })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .where(eq(certificates.id, id))
    .limit(1);
  if (!row || (!isAdmin && row.ownerUserId !== userId)) return null;
  return mapCertificate(row.certificate);
}

export type AdminCompletionCandidate = {
  enrollmentId: string;
  learnerName: string;
  courseTitle: string;
  policy: "automatic" | "admin_approval";
  lessonCompletionPercent: number;
  attendancePercent: number;
  assignmentPassPercent: number;
  status: "in_progress" | "qualified" | "pending_approval" | "completed";
  certificateIssued: boolean;
};

export async function getAdminCompletionCandidates(): Promise<AdminCompletionCandidate[]> {
  if (!hasDatabaseConnection()) {
    return canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: true })
      ? [
          {
            enrollmentId: "00000000-0000-4000-8000-000000000201",
            learnerName: "ชลิตา วงศ์ดี",
            courseTitle: "AI Fundamentals",
            policy: "admin_approval",
            lessonCompletionPercent: 100,
            attendancePercent: 84,
            assignmentPassPercent: 78,
            status: "pending_approval",
            certificateIssued: false,
          },
        ]
      : [];
  }

  const rows = await getDb()
    .select({
      enrollmentId: enrollments.id,
      learnerName: profiles.displayName,
      courseTitle: courseTable.title,
      policy: courseTable.completionPolicy,
      lessonCompletionPercent: enrollmentCompletions.lessonCompletionPercent,
      attendancePercent: enrollmentCompletions.attendancePercent,
      assignmentPassPercent: enrollmentCompletions.assignmentPassPercent,
      status: enrollmentCompletions.status,
      certificateId: certificates.id,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.userId, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courseTable, eq(courseTable.id, cohorts.courseId))
    .leftJoin(
      enrollmentCompletions,
      eq(enrollmentCompletions.enrollmentId, enrollments.id),
    )
    .leftJoin(
      certificates,
      and(eq(certificates.enrollmentId, enrollments.id), isNull(certificates.revokedAt)),
    )
    .orderBy(desc(cohorts.startsAt), asc(profiles.displayName));

  return rows.map((row) => ({
    enrollmentId: row.enrollmentId,
    learnerName: row.learnerName,
    courseTitle: row.courseTitle,
    policy: row.policy,
    lessonCompletionPercent: row.lessonCompletionPercent ?? 0,
    attendancePercent: row.attendancePercent ?? 0,
    assignmentPassPercent: row.assignmentPassPercent ?? 0,
    status: row.status ?? "in_progress",
    certificateIssued: Boolean(row.certificateId),
  }));
}

export type AdminOperationsData = {
  courses: Array<{ id: string; title: string }>;
  cohorts: Array<{ id: string; title: string; courseId: string; status: CohortCard["status"] }>;
  enrollments: Array<{ id: string; label: string }>;
  sessions: Array<{ id: string; cohortId: string; label: string }>;
  submissions: Array<{ id: string; label: string }>;
};

export async function getAdminOperationsData(): Promise<AdminOperationsData> {
  if (!hasDatabaseConnection()) {
    return canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: true })
      ? {
          courses: [{ id: "00000000-0000-4000-8000-000000000001", title: "AI Fundamentals" }],
          cohorts: demoCohorts.map((cohort) => ({ ...cohort, courseId: "00000000-0000-4000-8000-000000000001" })).map(({ id, title, courseId, status }) => ({ id, title, courseId, status })),
          enrollments: [{ id: demoEnrollment.id, label: "กาญจนา — AI Fundamentals" }],
          sessions: [{ id: "00000000-0000-4000-8000-000000000301", cohortId: demoCohorts[2].id, label: "Session 1 — AI วิเคราะห์ข้อมูล" }],
          submissions: [{ id: "00000000-0000-4000-8000-000000000401", label: "กาญจนา — แบบฝึกหัด 1" }],
        }
      : { courses: [], cohorts: [], enrollments: [], sessions: [], submissions: [] };
  }

  const db = getDb();
  const [courseRows, cohortRows, enrollmentRows, sessionRows, submissionRows] = await Promise.all([
    db.select({ id: courseTable.id, title: courseTable.title }).from(courseTable).orderBy(asc(courseTable.title)),
    db.select({ id: cohorts.id, title: cohorts.title, courseId: cohorts.courseId, status: cohorts.status }).from(cohorts).orderBy(asc(cohorts.startsAt)),
    db.select({ id: enrollments.id, learner: profiles.displayName, course: courseTable.title }).from(enrollments).innerJoin(profiles, eq(profiles.userId, enrollments.userId)).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courseTable, eq(courseTable.id, cohorts.courseId)).orderBy(asc(profiles.displayName)),
    db.select({ id: liveSessions.id, cohortId: liveSessions.cohortId, title: liveSessions.title, cohort: cohorts.title }).from(liveSessions).innerJoin(cohorts, eq(cohorts.id, liveSessions.cohortId)).orderBy(asc(liveSessions.startsAt)),
    db.select({ id: submissions.id, learner: profiles.displayName, assignment: assignments.title }).from(submissions).innerJoin(enrollments, eq(enrollments.id, submissions.enrollmentId)).innerJoin(profiles, eq(profiles.userId, enrollments.userId)).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).orderBy(asc(profiles.displayName)),
  ]);

  return {
    courses: courseRows,
    cohorts: cohortRows,
    enrollments: enrollmentRows.map((row) => ({ id: row.id, label: `${row.learner} — ${row.course}` })),
    sessions: sessionRows.map((row) => ({ id: row.id, cohortId: row.cohortId, label: `${row.title} — ${row.cohort}` })),
    submissions: submissionRows.map((row) => ({ id: row.id, label: `${row.learner} — ${row.assignment}` })),
  };
}

export async function getAdminCohorts(): Promise<CohortCard[]> {
  if (!hasDatabaseConnection()) return demoCohorts;
  const rows = await getDb()
    .select({
      cohort: cohorts,
      activeReservations: sql<number>`count(*) filter (where ${seatReservations.status} = 'active')`,
      waitlistedReservations: sql<number>`count(*) filter (where ${seatReservations.status} = 'waitlisted')`,
    })
    .from(cohorts)
    .leftJoin(seatReservations, eq(seatReservations.cohortId, cohorts.id))
    .groupBy(cohorts.id)
    .orderBy(asc(cohorts.startsAt));
  return rows.map(({ cohort, activeReservations, waitlistedReservations }) => ({
    id: cohort.id,
    title: cohort.title,
    status: cohort.status,
    startsAt: cohort.startsAt,
    registrationOpensAt: cohort.registrationOpensAt,
    registrationDeadlineAt: cohort.registrationDeadlineAt,
    minimumEnrollment: cohort.minimumEnrollment,
    maximumEnrollment: cohort.maximumEnrollment,
    activeReservations: Number(activeReservations),
    waitlistedReservations: Number(waitlistedReservations),
    fallbackCohortId: cohort.fallbackCohortId,
    overrideReason: cohort.overrideReason,
  }));
}

export async function getBetaScorecard() {
  if (!hasDatabaseConnection()) {
    return calculateBetaScorecard({
      cohorts: [
        {
          registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
          registrationDeadlineAt: new Date("2026-07-20T00:00:00.000Z"),
          thresholdReachedAt: new Date("2026-07-05T12:00:00.000Z"),
          confirmed: true,
          cancelledAfterConfirmation: false,
          confirmedBelowThreshold: false,
        },
        {
          registrationOpensAt: new Date("2026-07-01T00:00:00.000Z"),
          registrationDeadlineAt: new Date("2026-07-20T00:00:00.000Z"),
          thresholdReachedAt: null,
          confirmed: false,
          cancelledAfterConfirmation: false,
          confirmedBelowThreshold: false,
        },
      ],
      invitations: 46,
      acceptedInvitations: 31,
      reservations: 24,
      withdrawnReservations: 2,
      waitlistedReservations: 3,
      promotedWaitlistReservations: 1,
      enrollments: 12,
      qualifiedCompletions: 8,
      otpOrEmailFailures: 1,
      unauthorizedAccessAttempts: 0,
      protectedAccessFailures: 0,
      certificateGenerationFailures: 0,
    });
  }

  const db = getDb();
  const cohortRows = await db.select().from(cohorts);
  const [inviteCounts] = await db
    .select({
      total: count(),
      accepted: sql<number>`count(*) filter (where ${courseInvites.status} = 'accepted')`,
    })
    .from(courseInvites);
  const [reservationCounts] = await db
    .select({
      total: count(),
      withdrawn: sql<number>`count(*) filter (where ${seatReservations.status} = 'withdrawn')`,
      waitlisted: sql<number>`count(*) filter (where ${seatReservations.status} = 'waitlisted')`,
      promoted: sql<number>`count(*) filter (where ${seatReservations.status} = 'active' and ${seatReservations.updatedAt} > ${seatReservations.reservedAt})`,
    })
    .from(seatReservations);
  const [completionCounts] = await db
    .select({
      enrollments: count(),
      qualified: sql<number>`count(*) filter (where ${enrollmentCompletions.status} in ('qualified', 'pending_approval', 'completed'))`,
    })
    .from(enrollments)
    .leftJoin(enrollmentCompletions, eq(enrollmentCompletions.enrollmentId, enrollments.id));
  const failures = await db
    .select({ eventName: productEvents.eventName, value: count() })
    .from(productEvents)
    .where(
      inArray(productEvents.eventName, [
        "otp_email_failure",
        "unauthorized_access",
        "protected_access_failure",
        "certificate_generation_failure",
      ]),
    )
    .groupBy(productEvents.eventName);
  const failureCount = (eventName: string) =>
    Number(failures.find((row) => row.eventName === eventName)?.value ?? 0);

  return calculateBetaScorecard({
    cohorts: cohortRows.map((cohort) => ({
      registrationOpensAt: cohort.registrationOpensAt,
      registrationDeadlineAt: cohort.registrationDeadlineAt,
      thresholdReachedAt: cohort.thresholdReachedAt,
      confirmed: Boolean(cohort.confirmedAt),
      cancelledAfterConfirmation: cohort.status === "cancelled" && Boolean(cohort.confirmedAt),
      confirmedBelowThreshold: Boolean(cohort.overrideReason),
    })),
    invitations: Number(inviteCounts.total),
    acceptedInvitations: Number(inviteCounts.accepted),
    reservations: Number(reservationCounts.total),
    withdrawnReservations: Number(reservationCounts.withdrawn),
    waitlistedReservations: Number(reservationCounts.waitlisted),
    promotedWaitlistReservations: Number(reservationCounts.promoted),
    enrollments: Number(completionCounts.enrollments),
    qualifiedCompletions: Number(completionCounts.qualified),
    otpOrEmailFailures: failureCount("otp_email_failure"),
    unauthorizedAccessAttempts: failureCount("unauthorized_access"),
    protectedAccessFailures: failureCount("protected_access_failure"),
    certificateGenerationFailures: failureCount("certificate_generation_failure"),
  });
}

export async function getInviteSummary() {
  if (!hasDatabaseConnection()) {
    return [
      { cohortTitle: demoCohorts[0].title, invited: 18, accepted: 10, reserved: 4 },
      { cohortTitle: demoCohorts[1].title, invited: 14, accepted: 9, reserved: 8 },
    ];
  }
  return getDb()
    .select({
      cohortTitle: cohorts.title,
      invited: count(courseInvites.id),
      accepted: sql<number>`count(${courseInvites.id}) filter (where ${courseInvites.status} = 'accepted')`,
      reserved: sql<number>`count(${seatReservations.id}) filter (where ${seatReservations.status} in ('active', 'converted'))`,
    })
    .from(cohorts)
    .leftJoin(courseInvites, eq(courseInvites.cohortId, cohorts.id))
    .leftJoin(seatReservations, eq(seatReservations.inviteId, courseInvites.id))
    .groupBy(cohorts.id)
    .orderBy(asc(cohorts.startsAt));
}
