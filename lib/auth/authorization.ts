import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cohortInstructors, courseAuthors, enrollments } from "@/db/schema";
import { hasRole, type MemberRole } from "./roles";
import { getCurrentMember, type AppMember } from "./session";

export class AuthorizationError extends Error {
  constructor(message = "คุณไม่มีสิทธิ์ทำรายการนี้") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireMember(): Promise<AppMember> {
  const member = await getCurrentMember();
  if (!member) {
    throw new AuthorizationError("กรุณาเข้าสู่ระบบก่อนทำรายการ");
  }
  return member;
}

export async function requireAdmin(): Promise<AppMember> {
  return requireRole("admin", "รายการนี้สำหรับผู้ดูแลระบบเท่านั้น");
}

export async function requireRole(
  role: MemberRole,
  message = "คุณไม่มีสิทธิ์เข้าพื้นที่ทำงานนี้",
): Promise<AppMember> {
  const member = await requireMember();
  if (!hasRole(member.roles, role)) {
    throw new AuthorizationError(message);
  }
  return member;
}

export async function requireCourseAuthor(courseId: string): Promise<AppMember> {
  const member = await requireRole("instructor", "รายการนี้สำหรับผู้สอนเท่านั้น");
  const [assignment] = await getDb()
    .select({ courseId: courseAuthors.courseId })
    .from(courseAuthors)
    .where(and(eq(courseAuthors.courseId, courseId), eq(courseAuthors.userId, member.userId)))
    .limit(1);

  if (!assignment) {
    throw new AuthorizationError("คุณไม่ได้รับมอบหมายให้เขียนคอร์สนี้");
  }

  return member;
}

export async function requireCohortInstructor(cohortId: string): Promise<AppMember> {
  const member = await requireRole("instructor", "รายการนี้สำหรับผู้สอนเท่านั้น");
  const [assignment] = await getDb()
    .select({ cohortId: cohortInstructors.cohortId })
    .from(cohortInstructors)
    .where(
      and(
        eq(cohortInstructors.cohortId, cohortId),
        eq(cohortInstructors.userId, member.userId),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw new AuthorizationError("คุณไม่ได้รับมอบหมายให้ดูแลรุ่นเรียนนี้");
  }

  return member;
}

export async function requireEnrollmentOwner(enrollmentId: string) {
  const member = await requireMember();
  if (hasRole(member.roles, "admin")) {
    return member;
  }

  const [owned] = await getDb()
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, member.userId)))
    .limit(1);

  if (!owned) {
    throw new AuthorizationError("ไม่พบสิทธิ์เข้าเรียนสำหรับรายการนี้");
  }

  return member;
}
