"use server";

import { revalidatePath } from "next/cache";
import {
  assignCohortInstructor,
  assignCourseAuthor,
  grantMemberRole,
  revokeMemberRole,
} from "@/lib/services/access-management";
import type { MemberRole } from "@/lib/auth/roles";

export type AccessActionState = { ok: boolean; message: string };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";

async function run(operation: () => Promise<unknown>, success: string): Promise<AccessActionState> {
  try { await operation(); revalidatePath("/admin/access"); return { ok: true, message: success }; }
  catch (error) { return { ok: false, message: errorMessage(error) }; }
}

export async function grantRoleAction(_previous: AccessActionState, formData: FormData) {
  return run(() => grantMemberRole(String(formData.get("userId")), String(formData.get("role")) as MemberRole), "ให้สิทธิ์และบันทึก audit แล้ว");
}
export async function revokeRoleAction(_previous: AccessActionState, formData: FormData) {
  return run(() => revokeMemberRole(String(formData.get("userId")), String(formData.get("role")) as MemberRole), "ถอนสิทธิ์และบันทึก audit แล้ว");
}
export async function assignCourseAuthorAction(_previous: AccessActionState, formData: FormData) {
  return run(() => assignCourseAuthor(String(formData.get("courseId")), String(formData.get("userId"))), "มอบหมายผู้เขียนคอร์สแล้ว");
}
export async function assignCohortInstructorAction(_previous: AccessActionState, formData: FormData) {
  return run(() => assignCohortInstructor(String(formData.get("cohortId")), String(formData.get("userId"))), "มอบหมายผู้สอนประจำรุ่นแล้ว");
}
