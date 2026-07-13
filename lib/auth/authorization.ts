import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { enrollments } from "@/db/schema";
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
  const member = await requireMember();
  if (member.role !== "admin") {
    throw new AuthorizationError("รายการนี้สำหรับผู้ดูแลระบบเท่านั้น");
  }
  return member;
}

export async function requireEnrollmentOwner(enrollmentId: string) {
  const member = await requireMember();
  if (member.role === "admin") {
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
