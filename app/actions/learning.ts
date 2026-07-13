"use server";

import { revalidatePath } from "next/cache";
import {
  submitAssignmentForMember,
  updateLessonProgressForMember,
} from "@/lib/services/learning";

export type LearningActionState = { ok: boolean; message: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export async function updateLessonProgressAction(
  _previous: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  try {
    const enrollmentId = String(formData.get("enrollmentId"));
    await updateLessonProgressForMember({
      enrollmentId,
      lessonId: String(formData.get("lessonId")),
      progressPercent: String(formData.get("progressPercent")),
    });
    revalidatePath(`/learn/${enrollmentId}`);
    revalidatePath("/learn");
    return { ok: true, message: "บันทึกความคืบหน้าแล้ว" };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function submitAssignmentAction(
  _previous: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  try {
    const enrollmentId = String(formData.get("enrollmentId"));
    await submitAssignmentForMember({
      enrollmentId,
      assignmentId: String(formData.get("assignmentId")),
      submissionUrl: String(formData.get("submissionUrl")),
    });
    revalidatePath(`/learn/${enrollmentId}`);
    return { ok: true, message: "ส่งงานแล้ว ผู้สอนจะตรวจและแจ้งผลในหน้านี้" };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

