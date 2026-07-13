"use server";

import { revalidatePath } from "next/cache";
import { issueCertificateByAdmin } from "@/lib/services/certificates";
import { recalculateCompletionByAdmin } from "@/lib/services/completions";
import { setCertificateVisibility } from "@/lib/services/certificates";

export type CertificateActionState = { ok: boolean; message: string };

function actionError(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export async function recalculateCompletionAction(
  _previous: CertificateActionState,
  formData: FormData,
): Promise<CertificateActionState> {
  try {
    const result = await recalculateCompletionByAdmin({
      enrollmentId: String(formData.get("enrollmentId")),
      approve: formData.get("approve") === "true",
    });
    revalidatePath("/admin/certificates");
    return {
      ok: true,
      message:
        result.status === "completed"
          ? "บันทึก completion และออกใบประกาศแล้ว"
          : `คำนวณใหม่แล้ว: ${result.status}`,
    };
  } catch (error) {
    return { ok: false, message: actionError(error) };
  }
}

export async function issueCertificateAction(
  _previous: CertificateActionState,
  formData: FormData,
): Promise<CertificateActionState> {
  try {
    await issueCertificateByAdmin(String(formData.get("enrollmentId")));
    revalidatePath("/admin/certificates");
    return { ok: true, message: "ออกใบประกาศแล้ว" };
  } catch (error) {
    return { ok: false, message: actionError(error) };
  }
}

export async function setCertificateVisibilityAction(formData: FormData) {
  await setCertificateVisibility({
    certificateId: String(formData.get("certificateId")),
    publicVerificationEnabled: formData.get("publicVerificationEnabled") === "true",
  });
  revalidatePath("/account/certificates");
}
