import { and, eq } from "drizzle-orm";
import { closeDbConnection, getDb } from "./index";
import {
  cohorts,
  courseFields,
  courseInstructors,
  courses,
  courseTools,
  instructors,
  lessons,
} from "./schema";
import { courses as catalog } from "../lib/catalog";

if (process.env.CONFIRM_SEED !== "preview") {
  throw new Error("Refusing to seed. Set CONFIRM_SEED=preview for an empty Preview branch only.");
}

const db = getDb();
const levelMap = {
  เริ่มต้น: "beginner",
  ประยุกต์ใช้: "applied",
  เชี่ยวชาญ: "expert",
} as const;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

async function seed() {
  for (const [index, item] of catalog.entries()) {
    const [course] = await db
      .insert(courses)
      .values({
        slug: item.id,
        title: item.title,
        summary: `เรียน ${item.title} ผ่านโจทย์จริง ภาษาไทย และ feedback จากผู้สอน`,
        level: levelMap[item.level],
        status: "published",
        durationMinutes: Number.parseInt(item.duration, 10) * 60,
        certificateEnabled: item.certificate,
        completionPolicy: index % 2 === 0 ? "automatic" : "admin_approval",
        defaultMinimumEnrollment: 8,
        defaultMaximumEnrollment: 16,
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: courses.slug,
        set: {
          title: item.title,
          level: levelMap[item.level],
          status: "published",
          updatedAt: new Date(),
        },
      })
      .returning();

    let [instructor] = await db
      .select()
      .from(instructors)
      .where(eq(instructors.name, item.instructor))
      .limit(1);
    if (!instructor) {
      [instructor] = await db
        .insert(instructors)
        .values({ name: item.instructor, avatarUrl: item.avatar })
        .returning();
    }
    await db
      .insert(courseInstructors)
      .values({ courseId: course.id, instructorId: instructor.id })
      .onConflictDoNothing();

    await db.delete(courseTools).where(eq(courseTools.courseId, course.id));
    await db.delete(courseFields).where(eq(courseFields.courseId, course.id));
    await db.insert(courseTools).values(item.tools.map((tool) => ({ courseId: course.id, tool })));
    await db.insert(courseFields).values(item.fields.map((field) => ({ courseId: course.id, field })));

    const existingLessons = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.courseId, course.id))
      .limit(1);
    if (existingLessons.length === 0) {
      await db.insert(lessons).values([
        { courseId: course.id, title: "วางโจทย์และเลือกเครื่องมือ", kind: "live", sortOrder: 1, durationMinutes: 90 },
        { courseId: course.id, title: "ลงมือทำกับ workflow จริง", kind: "workshop", sortOrder: 2, durationMinutes: 120 },
        { courseId: course.id, title: "ตรวจคุณภาพและนำไปใช้", kind: "video", sortOrder: 3, durationMinutes: 60 },
      ]);
    }

    if (item.format === "คลาสสด") {
      const cohortTitle = `${item.title} · Closed Beta`;
      const [existing] = await db
        .select({ id: cohorts.id })
        .from(cohorts)
        .where(and(eq(cohorts.courseId, course.id), eq(cohorts.title, cohortTitle)))
        .limit(1);
      if (!existing) {
        const startsAt = addDays(new Date(), 21 + index * 7);
        await db.insert(cohorts).values({
          courseId: course.id,
          title: cohortTitle,
          status: "collecting",
          startsAt,
          endsAt: addDays(startsAt, 1),
          minimumEnrollment: 8,
          maximumEnrollment: 16,
          registrationOpensAt: new Date(),
          registrationDeadlineAt: addDays(startsAt, -7),
        });
      }
    }
  }
}

seed()
  .then(async () => {
    console.log(`Seeded ${catalog.length} courses into the Preview database branch.`);
    await closeDbConnection();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await closeDbConnection();
    process.exitCode = 1;
  });
