import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import {
  courseAuthors,
  courseModules,
  courseRevisions,
  courses,
  lessons,
} from "@/db/schema";
import { validateRevisionDraft } from "@/lib/domain/course-revision";
import { canUseDemoData } from "./demo-policy";

export type CourseStudioView = {
  courseId: string;
  courseTitle: string;
  revision: {
    id: string;
    revisionNumber: number;
    version: number;
    status: "draft" | "in_review" | "changes_requested" | "approved" | "retired";
    title: string;
    summary: string;
    reviewNotes: string | null;
  } | null;
  modules: Array<{
    id: string;
    title: string;
    lessons: Array<{ id: string; title: string; kind: "live" | "video" | "reading" | "workshop" }>;
  }>;
  validationIssues: string[];
};

const demoStudio: CourseStudioView = {
  courseId: "00000000-0000-4000-8000-000000000001",
  courseTitle: "AI Fundamentals",
  revision: {
    id: "00000000-0000-4000-8000-000000000501",
    revisionNumber: 2,
    version: 4,
    status: "draft",
    title: "AI Fundamentals: เริ่มต้นอย่างเข้าใจและปลอดภัย",
    summary: "เรียนรู้หลักคิดสำคัญของ AI ฝึกใช้เครื่องมืออย่างเป็นระบบ และนำไปใช้กับงานจริงอย่างปลอดภัย",
    reviewNotes: null,
  },
  modules: [
    {
      id: "module-1",
      title: "Module 1 · รู้จัก AI",
      lessons: [
        { id: "lesson-1", title: "AI ทำอะไรได้และไม่ได้", kind: "live" },
        { id: "lesson-2", title: "ทดลองใช้โมเดลภาษา", kind: "workshop" },
      ],
    },
    {
      id: "module-2",
      title: "Module 2 · ใช้อย่างรับผิดชอบ",
      lessons: [
        { id: "lesson-3", title: "ข้อมูลส่วนบุคคลและ hallucination", kind: "reading" },
      ],
    },
  ],
  validationIssues: [],
};

export async function getCourseStudioView(
  courseId: string,
  userId: string,
  demo = false,
): Promise<CourseStudioView | null> {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return { ...demoStudio, courseId };
  }
  if (!hasDatabaseConnection()) return null;
  const db = getDb();
  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courseAuthors)
    .innerJoin(courses, eq(courses.id, courseAuthors.courseId))
    .where(and(eq(courseAuthors.userId, userId), eq(courseAuthors.courseId, courseId)))
    .limit(1);
  if (!course) return null;

  const [revision] = await db
    .select()
    .from(courseRevisions)
    .where(eq(courseRevisions.courseId, courseId))
    .orderBy(desc(courseRevisions.revisionNumber))
    .limit(1);
  if (!revision) {
    return { courseId, courseTitle: course.title, revision: null, modules: [], validationIssues: [] };
  }

  const moduleRows = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.revisionId, revision.id))
    .orderBy(asc(courseModules.sortOrder));
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.revisionId, revision.id))
    .orderBy(asc(lessons.sortOrder));
  const modules = moduleRows.map((module) => ({
    id: module.id,
    title: module.title,
    lessons: lessonRows
      .filter((lesson) => lesson.moduleId === module.id)
      .map((lesson) => ({ id: lesson.id, title: lesson.title, kind: lesson.kind })),
  }));
  return {
    courseId,
    courseTitle: course.title,
    revision: {
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      version: revision.version,
      status: revision.status,
      title: revision.title,
      summary: revision.summary,
      reviewNotes: revision.reviewNotes,
    },
    modules,
    validationIssues: validateRevisionDraft({
      title: revision.title,
      summary: revision.summary,
      modules: modules.map((module) => ({ title: module.title, lessonCount: module.lessons.length })),
      assignmentCount: 0,
    }),
  };
}

export async function getCourseReviewQueue(demo = false) {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) {
    return [
      {
        id: "00000000-0000-4000-8000-000000000502",
        courseTitle: "ChatGPT และ Claude สำหรับงานเขียน",
        revisionNumber: 3,
        submittedAt: new Date("2026-07-13T08:30:00.000Z"),
      },
    ];
  }
  if (!hasDatabaseConnection()) return [];
  return getDb()
    .select({
      id: courseRevisions.id,
      courseTitle: courseRevisions.title,
      revisionNumber: courseRevisions.revisionNumber,
      submittedAt: courseRevisions.submittedAt,
    })
    .from(courseRevisions)
    .where(eq(courseRevisions.status, "in_review"))
    .orderBy(asc(courseRevisions.submittedAt));
}
