import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  cohortInstructors,
  cohorts,
  courseAuthors,
  courses,
  instructors,
  memberRoles,
  profiles,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/authorization";
import { type MemberRole } from "@/lib/auth/roles";

const uuid = z.string().uuid();
const roleSchema = z.enum(["student", "instructor", "admin"]);

export async function grantMemberRole(rawUserId: string, rawRole: MemberRole) {
  const userId = z.string().min(1).parse(rawUserId);
  const role = roleSchema.parse(rawRole);
  const admin = await requireAdmin();
  return getDb().transaction(async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (!profile) throw new Error("ไม่พบบัญชีผู้ใช้");
    await tx.insert(memberRoles).values({ userId, role, grantedByUserId: admin.userId }).onConflictDoNothing();
    if (role === "instructor") {
      await tx.insert(instructors).values({ profileUserId: userId, name: profile.displayName, avatarUrl: profile.avatarUrl }).onConflictDoNothing({ target: instructors.profileUserId });
    }
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "member_role.grant", entityType: "profile", entityId: userId, metadata: { role } });
    return { userId, role };
  });
}

export async function revokeMemberRole(rawUserId: string, rawRole: MemberRole) {
  const userId = z.string().min(1).parse(rawUserId);
  const role = roleSchema.parse(rawRole);
  if (role === "student") throw new Error("ทุกบัญชีต้องคงสิทธิ์ผู้เรียนไว้");
  const admin = await requireAdmin();
  if (userId === admin.userId && role === "admin") throw new Error("ไม่สามารถถอนสิทธิ์แอดมินของบัญชีที่กำลังใช้งาน");
  await getDb().transaction(async (tx) => {
    await tx.delete(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.role, role)));
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "member_role.revoke", entityType: "profile", entityId: userId, metadata: { role } });
  });
}

async function assertInstructorRole(userId: string) {
  const [role] = await getDb().select().from(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.role, "instructor"))).limit(1);
  if (!role) throw new Error("ต้องให้สิทธิ์ผู้สอนก่อนมอบหมายคอร์สหรือรุ่นเรียน");
}

export async function assignCourseAuthor(rawCourseId: string, rawUserId: string) {
  const courseId = uuid.parse(rawCourseId);
  const userId = z.string().min(1).parse(rawUserId);
  const admin = await requireAdmin();
  await assertInstructorRole(userId);
  const [course] = await getDb().select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw new Error("ไม่พบคอร์ส");
  await getDb().transaction(async (tx) => {
    await tx.insert(courseAuthors).values({ courseId, userId, assignedByUserId: admin.userId }).onConflictDoNothing();
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "course_author.assign", entityType: "course", entityId: courseId, metadata: { userId } });
  });
}

export async function assignCohortInstructor(rawCohortId: string, rawUserId: string) {
  const cohortId = uuid.parse(rawCohortId);
  const userId = z.string().min(1).parse(rawUserId);
  const admin = await requireAdmin();
  await assertInstructorRole(userId);
  const [cohort] = await getDb().select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort) throw new Error("ไม่พบรุ่นเรียน");
  await getDb().transaction(async (tx) => {
    await tx.insert(cohortInstructors).values({ cohortId, userId, assignedByUserId: admin.userId }).onConflictDoNothing();
    await tx.insert(auditLogs).values({ actorUserId: admin.userId, action: "cohort_instructor.assign", entityType: "cohort", entityId: cohortId, metadata: { userId } });
  });
}
