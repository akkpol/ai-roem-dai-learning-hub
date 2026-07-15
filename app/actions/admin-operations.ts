"use server";

import { revalidatePath } from "next/cache";
import {
  createCohortByAdmin,
  createCourseMaterialByAdmin,
  createLiveSessionByAdmin,
  openCohortRegistrationByAdmin,
  recordAttendanceByAdmin,
  reviewSubmissionByAdmin,
  setFallbackCohortByAdmin,
  updateCohortByAdmin,
} from "@/lib/services/admin-operations";

export type AdminOperationState = { ok: boolean; message: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

async function runAdminOperation(
  operation: () => Promise<unknown>,
  successMessage: string,
): Promise<AdminOperationState> {
  try {
    await operation();
    revalidatePath("/admin/cohorts");
    return { ok: true, message: successMessage };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function createCohortAction(_previous: AdminOperationState, formData: FormData) {
  return runAdminOperation(
    () =>
      createCohortByAdmin({
        courseId: String(formData.get("courseId")),
        courseRevisionId: String(formData.get("courseRevisionId") || "") || undefined,
        admissionMode: String(formData.get("admissionMode") || "invite_only") as "public" | "invite_only",
        priceBaht: String(formData.get("priceBaht") || "0"),
        title: String(formData.get("title")),
        startsAt: String(formData.get("startsAt")),
        endsAt: String(formData.get("endsAt") || "") || undefined,
        registrationOpensAt: String(formData.get("registrationOpensAt")),
        registrationDeadlineAt: String(formData.get("registrationDeadlineAt")),
        minimumEnrollment: String(formData.get("minimumEnrollment")),
        maximumEnrollment: String(formData.get("maximumEnrollment")),
      }),
    "สร้างรุ่นเรียนแบบ draft แล้ว",
  );
}

export async function updateCohortAction(_previous: AdminOperationState, formData: FormData) {
  return runAdminOperation(
    () =>
      updateCohortByAdmin({
        cohortId: String(formData.get("cohortId")),
        startsAt: String(formData.get("startsAt")),
        registrationOpensAt: String(formData.get("registrationOpensAt")),
        registrationDeadlineAt: String(formData.get("registrationDeadlineAt")),
        minimumEnrollment: String(formData.get("minimumEnrollment")),
        maximumEnrollment: String(formData.get("maximumEnrollment")),
      }),
    "อัปเดตรุ่นเรียนและบันทึก audit แล้ว",
  );
}

export async function openCohortRegistrationAction(_previous: AdminOperationState, formData: FormData) {
  return runAdminOperation(
    () => openCohortRegistrationByAdmin(String(formData.get("cohortId"))),
    "เปิดรับคำจองของรุ่นนี้แล้ว",
  );
}

export async function setFallbackCohortAction(_previous: AdminOperationState, formData: FormData) {
  return runAdminOperation(
    () => setFallbackCohortByAdmin({ cohortId: String(formData.get("cohortId")), fallbackCohortId: String(formData.get("fallbackCohortId")) }),
    "กำหนดรุ่นถัดไปแล้ว ผู้เรียนยังต้องกดยืนยันเอง",
  );
}

export async function createLiveSessionAction(_previous: AdminOperationState, formData: FormData) {
  return runAdminOperation(
    () => createLiveSessionByAdmin({ cohortId: String(formData.get("cohortId")), title: String(formData.get("title")), startsAt: String(formData.get("startsAt")), endsAt: String(formData.get("endsAt") || "") || undefined, meetingProvider: String(formData.get("meetingProvider") || "") || undefined, meetingUrl: String(formData.get("meetingUrl") || "") || undefined }),
    "เพิ่ม live session แล้ว",
  );
}

export async function createCourseMaterialAction(_previous: AdminOperationState, formData: FormData) {
  const file = formData.get("file");
  return runAdminOperation(
    () => createCourseMaterialByAdmin({
      courseId: String(formData.get("courseId")),
      title: String(formData.get("title")),
      kind: String(formData.get("kind")) as "document" | "worksheet" | "link",
      externalUrl: String(formData.get("externalUrl") || "") || undefined,
      file: file instanceof File ? file : undefined,
    }),
    "เพิ่มเอกสารประกอบแล้ว",
  );
}

export async function recordAttendanceAction(_previous: AdminOperationState, formData: FormData) {
  return runAdminOperation(
    () => recordAttendanceByAdmin({ enrollmentId: String(formData.get("enrollmentId")), liveSessionId: String(formData.get("liveSessionId")), attendancePercent: String(formData.get("attendancePercent")) }),
    "บันทึก attendance แล้ว",
  );
}

export async function reviewSubmissionAction(_previous: AdminOperationState, formData: FormData) {
  return runAdminOperation(
    () => reviewSubmissionByAdmin({ submissionId: String(formData.get("submissionId")), score: String(formData.get("score")), status: String(formData.get("status")) as "approved" | "rejected", feedback: String(formData.get("feedback") || "") || undefined }),
    "บันทึกผลตรวจงานแล้ว",
  );
}
