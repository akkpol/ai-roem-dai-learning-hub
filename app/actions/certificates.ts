"use server";

import { revalidatePath } from "next/cache";
import { setCertificateVisibility } from "@/lib/services/certificates";

export async function setCertificateVisibilityAction(formData: FormData) {
  await setCertificateVisibility({
    certificateId: String(formData.get("certificateId")),
    publicVerificationEnabled: formData.get("publicVerificationEnabled") === "true",
  });
  revalidatePath("/account/certificates");
}
