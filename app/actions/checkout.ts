"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCheckoutForReservation,
  issueApprovedRefund,
  openPaymentCollection,
} from "@/lib/services/commerce";

export type PaymentActionState = { ok: boolean; message: string };

export async function startCheckoutAction(formData: FormData) {
  const result = await createCheckoutForReservation(String(formData.get("reservationId")));
  redirect(result.url);
}

export async function openPaymentCollectionAction(formData: FormData) {
  await openPaymentCollection(String(formData.get("cohortId")));
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/payments");
}

export async function openPaymentCollectionStateAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const result = await openPaymentCollection(String(formData.get("cohortId")));
    revalidatePath("/admin/cohorts");
    revalidatePath("/admin/payments");
    return { ok: true, message: `เปิดชำระเงินแล้ว ${result.ordersCreated} order · หมดเวลาใน 48 ชั่วโมง` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "เปิดชำระเงินไม่สำเร็จ" };
  }
}

export async function issueRefundAction(formData: FormData) {
  await issueApprovedRefund(String(formData.get("refundId")));
  revalidatePath("/admin/payments");
}
