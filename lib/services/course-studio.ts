import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  assignments,
  auditLogs,
  courseMaterials,
  courseModules,
  courseRevisions,
  courses,
  lessons,
} from "@/db/schema";
import { requireAdmin, requireCourseAuthor } from "@/lib/auth/authorization";
import {
  assertRevisionEditable,
  assertRevisionTransition,
  getNextRevisionNumber,
  validateRevisionDraft,
} from "@/lib/domain/course-revision";
import { learningStudioFlags } from "@/lib/feature-flags";

const uuid = z.string().uuid();

function assertAuthoringEnabled() {
  if (!learningStudioFlags.authoring) throw new Error("Course Studio ยังไม่เปิดใช้งานใน environment นี้");
}

export async function createNextRevision(rawCourseId: string) {
  assertAuthoringEnabled();
  const courseId = uuid.parse(rawCourseId);
  const author = await requireCourseAuthor(courseId);

  return getDb().transaction(async (tx) => {
    const [course] = await tx
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .for("update")
      .limit(1);
    if (!course) throw new Error("ไม่พบคอร์ส");

    const revisions = await tx
      .select()
      .from(courseRevisions)
      .where(eq(courseRevisions.courseId, courseId))
      .orderBy(desc(courseRevisions.revisionNumber));
    const editable = revisions.find((revision) =>
      ["draft", "changes_requested"].includes(revision.status),
    );
    if (editable) return editable;

    const base = revisions.find((revision) => revision.status === "approved") ?? revisions[0];
    const [created] = await tx
      .insert(courseRevisions)
      .values({
        courseId,
        revisionNumber: getNextRevisionNumber(revisions.map((revision) => revision.revisionNumber)),
        title: base?.title ?? course.title,
        summary: base?.summary ?? course.summary,
        coverUrl: base?.coverUrl ?? course.coverUrl,
        durationMinutes: base?.durationMinutes ?? course.durationMinutes,
        certificateEnabled: base?.certificateEnabled ?? course.certificateEnabled,
        completionPolicy: base?.completionPolicy ?? course.completionPolicy,
        createdByUserId: author.userId,
      })
      .returning();

    if (base) {
      const sourceModules = await tx
        .select()
        .from(courseModules)
        .where(eq(courseModules.revisionId, base.id))
        .orderBy(asc(courseModules.sortOrder));
      const moduleIdMap = new Map<string, string>();
      for (const courseModule of sourceModules) {
        const [copy] = await tx
          .insert(courseModules)
          .values({
            revisionId: created.id,
            title: courseModule.title,
            summary: courseModule.summary,
            sortOrder: courseModule.sortOrder,
          })
          .returning({ id: courseModules.id });
        moduleIdMap.set(courseModule.id, copy.id);
      }

      const [sourceLessons, sourceAssignments, sourceMaterials] = await Promise.all([
        tx.select().from(lessons).where(eq(lessons.revisionId, base.id)),
        tx.select().from(assignments).where(eq(assignments.revisionId, base.id)),
        tx.select().from(courseMaterials).where(eq(courseMaterials.revisionId, base.id)),
      ]);
      if (sourceLessons.length) {
        await tx.insert(lessons).values(
          sourceLessons.map((lesson) => ({
            courseId,
            revisionId: created.id,
            moduleId: lesson.moduleId ? moduleIdMap.get(lesson.moduleId) : null,
            title: lesson.title,
            kind: lesson.kind,
            sortOrder: lesson.sortOrder,
            required: lesson.required,
            durationMinutes: lesson.durationMinutes,
            recordingUrl: lesson.recordingUrl,
          })),
        );
      }
      if (sourceAssignments.length) {
        await tx.insert(assignments).values(
          sourceAssignments.map((assignment) => ({
            courseId,
            revisionId: created.id,
            moduleId: assignment.moduleId ? moduleIdMap.get(assignment.moduleId) : null,
            sortOrder: assignment.sortOrder,
            title: assignment.title,
            instructions: assignment.instructions,
            passingScore: assignment.passingScore,
            required: assignment.required,
          })),
        );
      }
      if (sourceMaterials.length) {
        await tx.insert(courseMaterials).values(
          sourceMaterials.map((material) => ({
            courseId,
            revisionId: created.id,
            lessonId: null,
            title: material.title,
            kind: material.kind,
            blobPathname: material.blobPathname,
            externalUrl: material.externalUrl,
          })),
        );
      }
    }

    await tx.insert(auditLogs).values({
      actorUserId: author.userId,
      action: "course_revision.create",
      entityType: "course_revision",
      entityId: created.id,
      metadata: { courseId, revisionNumber: created.revisionNumber },
    });
    return created;
  });
}

export async function saveRevisionDraft(input: {
  revisionId: string;
  expectedVersion: number | string;
  title: string;
  summary: string;
}) {
  assertAuthoringEnabled();
  const parsed = z
    .object({
      revisionId: uuid,
      expectedVersion: z.coerce.number().int().positive(),
      title: z.string().trim().min(1).max(200),
      summary: z.string().trim().min(1).max(3000),
    })
    .parse(input);
  const [revision] = await getDb()
    .select()
    .from(courseRevisions)
    .where(eq(courseRevisions.id, parsed.revisionId))
    .limit(1);
  if (!revision) throw new Error("ไม่พบ revision");
  const author = await requireCourseAuthor(revision.courseId);
  assertRevisionEditable(revision.status);

  const [updated] = await getDb()
    .update(courseRevisions)
    .set({
      title: parsed.title,
      summary: parsed.summary,
      version: sql`${courseRevisions.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(courseRevisions.id, parsed.revisionId),
        eq(courseRevisions.version, parsed.expectedVersion),
      ),
    )
    .returning();
  if (!updated) throw new Error("มีผู้แก้ไข revision นี้ก่อนหน้า กรุณาโหลดข้อมูลล่าสุด");
  await getDb().insert(auditLogs).values({
    actorUserId: author.userId,
    action: "course_revision.save",
    entityType: "course_revision",
    entityId: updated.id,
    metadata: { version: updated.version },
  });
  return updated;
}

export async function submitRevisionForReview(rawRevisionId: string) {
  assertAuthoringEnabled();
  const revisionId = uuid.parse(rawRevisionId);
  const db = getDb();
  const [revision] = await db
    .select()
    .from(courseRevisions)
    .where(eq(courseRevisions.id, revisionId))
    .limit(1);
  if (!revision) throw new Error("ไม่พบ revision");
  const author = await requireCourseAuthor(revision.courseId);
  assertRevisionTransition(revision.status, "in_review");

  const modules = await db
    .select({
      title: courseModules.title,
      lessonCount: count(lessons.id),
    })
    .from(courseModules)
    .leftJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .where(eq(courseModules.revisionId, revision.id))
    .groupBy(courseModules.id)
    .orderBy(asc(courseModules.sortOrder));
  const [assignmentStats] = await db
    .select({ assignmentCount: count(assignments.id) })
    .from(assignments)
    .where(eq(assignments.revisionId, revision.id));
  const issues = validateRevisionDraft({
    title: revision.title,
    summary: revision.summary,
    modules: modules.map((module) => ({
      title: module.title,
      lessonCount: Number(module.lessonCount),
    })),
    assignmentCount: Number(assignmentStats?.assignmentCount ?? 0),
  });
  if (issues.length) throw new Error(issues.join(" · "));

  return db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(courseRevisions)
      .set({
        status: "in_review",
        submittedAt: now,
        reviewNotes: null,
        version: sql`${courseRevisions.version} + 1`,
        updatedAt: now,
      })
      .where(eq(courseRevisions.id, revision.id))
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId: author.userId,
      action: "course_revision.submit",
      entityType: "course_revision",
      entityId: revision.id,
    });
    return updated;
  });
}

export async function reviewRevision(input: {
  revisionId: string;
  decision: "approved" | "changes_requested";
  notes?: string;
}) {
  assertAuthoringEnabled();
  const parsed = z
    .object({
      revisionId: uuid,
      decision: z.enum(["approved", "changes_requested"]),
      notes: z.string().trim().max(2000).optional(),
    })
    .superRefine((value, context) => {
      if (value.decision === "changes_requested" && !value.notes) {
        context.addIssue({ code: "custom", path: ["notes"], message: "กรุณาระบุสิ่งที่ต้องแก้" });
      }
    })
    .parse(input);
  const admin = await requireAdmin();

  return getDb().transaction(async (tx) => {
    const [revision] = await tx
      .select()
      .from(courseRevisions)
      .where(eq(courseRevisions.id, parsed.revisionId))
      .for("update")
      .limit(1);
    if (!revision) throw new Error("ไม่พบ revision");
    assertRevisionTransition(revision.status, parsed.decision);
    const now = new Date();
    if (parsed.decision === "approved") {
      await tx
        .update(courseRevisions)
        .set({ status: "retired", updatedAt: now })
        .where(
          and(
            eq(courseRevisions.courseId, revision.courseId),
            eq(courseRevisions.status, "approved"),
          ),
        );
    }
    const [updated] = await tx
      .update(courseRevisions)
      .set({
        status: parsed.decision,
        reviewNotes: parsed.notes ?? null,
        reviewedByUserId: admin.userId,
        reviewedAt: now,
        approvedAt: parsed.decision === "approved" ? now : null,
        version: sql`${courseRevisions.version} + 1`,
        updatedAt: now,
      })
      .where(eq(courseRevisions.id, revision.id))
      .returning();
    if (parsed.decision === "approved") {
      await tx
        .update(courses)
        .set({
          title: revision.title,
          summary: revision.summary,
          coverUrl: revision.coverUrl,
          durationMinutes: revision.durationMinutes,
          certificateEnabled: revision.certificateEnabled,
          completionPolicy: revision.completionPolicy,
          status: "published",
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(courses.id, revision.courseId));
    }
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: `course_revision.${parsed.decision}`,
      entityType: "course_revision",
      entityId: revision.id,
      metadata: { notes: parsed.notes ?? null },
    });
    return updated;
  });
}
