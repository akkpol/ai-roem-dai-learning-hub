"use server";

import { revalidatePath } from "next/cache";
import {
  recordBatchAttendance,
  reviewAssignedSubmission,
  scheduleAssignedSession,
} from "@/lib/services/instructor-operations";

export type InstructorOperationState = { ok: boolean; message: string };

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";

export async function scheduleSessionAction(
  _previous: InstructorOperationState,
  formData: FormData,
): Promise<InstructorOperationState> {
  try {
    const cohortId = String(formData.get("cohortId"));
    await scheduleAssignedSession({
      cohortId,
      title: String(formData.get("title")),
      startsAt: String(formData.get("startsAt")),
      endsAt: String(formData.get("endsAt") || "") || undefined,
      meetingProvider: String(formData.get("meetingProvider") || "") || undefined,
      meetingUrl: String(formData.get("meetingUrl") || "") || undefined,
    });
    revalidatePath(`/teach/cohorts/${cohortId}`);
    return { ok: true, message: "เพิ่ม session แล้ว" };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function batchAttendanceAction(
  _previous: InstructorOperationState,
  formData: FormData,
): Promise<InstructorOperationState> {
  try {
    const cohortId = String(formData.get("cohortId"));
    const enrollmentIds = formData.getAll("enrollmentId").map(String);
    const rows = enrollmentIds.map((enrollmentId) => ({
      enrollmentId,
      attendancePercent: Number(formData.get(`attendance:${enrollmentId}`)),
    }));
    const result = await recordBatchAttendance({
      cohortId,
      liveSessionId: String(formData.get("liveSessionId")),
      rows,
    });
    revalidatePath(`/teach/cohorts/${cohortId}`);
    return { ok: true, message: `บันทึก attendance ${result.count} คนแล้ว` };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function reviewSubmissionAction(
  _previous: InstructorOperationState,
  formData: FormData,
): Promise<InstructorOperationState> {
  try {
    await reviewAssignedSubmission({
      submissionId: String(formData.get("submissionId")),
      score: String(formData.get("score")),
      status: String(formData.get("status")) as "approved" | "rejected",
      feedback: String(formData.get("feedback") || "") || undefined,
    });
    const cohortId = String(formData.get("cohortId"));
    revalidatePath(`/teach/cohorts/${cohortId}`);
    return { ok: true, message: "บันทึกผลตรวจงานแล้ว" };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
