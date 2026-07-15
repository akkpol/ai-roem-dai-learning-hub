"use server";

import { revalidatePath } from "next/cache";
import {
  createNextRevision,
  reviewRevision,
  saveRevisionDraft,
  submitRevisionForReview,
} from "@/lib/services/course-studio";

export type CourseStudioActionState = { ok: boolean; message: string };

function message(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export async function createRevisionAction(formData: FormData) {
  const revision = await createNextRevision(String(formData.get("courseId")));
  revalidatePath(`/teach/courses/${revision.courseId}`);
}

export async function saveRevisionAction(
  _previous: CourseStudioActionState,
  formData: FormData,
): Promise<CourseStudioActionState> {
  try {
    const revision = await saveRevisionDraft({
      revisionId: String(formData.get("revisionId")),
      expectedVersion: String(formData.get("expectedVersion")),
      title: String(formData.get("title")),
      summary: String(formData.get("summary")),
    });
    revalidatePath(`/teach/courses/${revision.courseId}`);
    return { ok: true, message: "บันทึก revision แล้ว" };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function submitRevisionAction(
  _previous: CourseStudioActionState,
  formData: FormData,
): Promise<CourseStudioActionState> {
  try {
    const revision = await submitRevisionForReview(String(formData.get("revisionId")));
    revalidatePath(`/teach/courses/${revision.courseId}`);
    revalidatePath("/admin/reviews");
    return { ok: true, message: "ส่ง revision ให้แอดมินตรวจแล้ว" };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function reviewRevisionAction(
  _previous: CourseStudioActionState,
  formData: FormData,
): Promise<CourseStudioActionState> {
  try {
    await reviewRevision({
      revisionId: String(formData.get("revisionId")),
      decision: String(formData.get("decision")) as "approved" | "changes_requested",
      notes: String(formData.get("notes") || "") || undefined,
    });
    revalidatePath("/admin/reviews");
    return { ok: true, message: "บันทึกผลตรวจ revision แล้ว" };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}
