"use server";

import { revalidatePath } from "next/cache";
import {
  acceptFallbackCohort,
  cancelConfirmedCohort,
  confirmCohortByAdmin,
  reserveInvitedSeat,
  withdrawSeatReservation,
} from "@/lib/services/cohorts";

export type CohortActionState = { ok: boolean; message: string };

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export async function reserveSeatAction(
  _previous: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  try {
    await reserveInvitedSeat(String(formData.get("cohortId")));
    revalidatePath(`/courses/${String(formData.get("courseSlug"))}`);
    return { ok: true, message: "รับคำจองแล้ว เราจะแจ้งอีกครั้งเมื่อทีมงานยืนยันเปิดคลาส" };
  } catch (error) {
    return { ok: false, message: messageFromError(error) };
  }
}

export async function withdrawReservationAction(
  _previous: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  try {
    await withdrawSeatReservation(String(formData.get("reservationId")));
    revalidatePath("/learn");
    return { ok: true, message: "ถอนคำจองแล้ว" };
  } catch (error) {
    return { ok: false, message: messageFromError(error) };
  }
}

export async function confirmCohortAction(
  _previous: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  try {
    await confirmCohortByAdmin({
      cohortId: String(formData.get("cohortId")),
      overrideReason: String(formData.get("overrideReason") || "") || undefined,
    });
    revalidatePath("/admin/cohorts");
    return { ok: true, message: "ยืนยันเปิดคลาสและสร้าง enrollment แล้ว" };
  } catch (error) {
    return { ok: false, message: messageFromError(error) };
  }
}

export async function cancelCohortAction(
  _previous: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  try {
    await cancelConfirmedCohort({
      cohortId: String(formData.get("cohortId")),
      reason: String(formData.get("reason")),
    });
    revalidatePath("/admin/cohorts");
    return { ok: true, message: "ยกเลิกคลาสและบันทึก audit log แล้ว" };
  } catch (error) {
    return { ok: false, message: messageFromError(error) };
  }
}

export async function acceptFallbackAction(
  _previous: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  try {
    await acceptFallbackCohort(String(formData.get("cohortId")));
    revalidatePath("/learn");
    return { ok: true, message: "ยืนยันวันใหม่แล้ว ระบบไม่ได้ย้ายคุณจนกว่าจะกดปุ่มนี้" };
  } catch (error) {
    return { ok: false, message: messageFromError(error) };
  }
}
