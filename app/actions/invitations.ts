"use server";

import { revalidatePath } from "next/cache";
import { inviteMembersToCohort } from "@/lib/services/invitations";

export type InviteActionState = { ok: boolean; message: string };

export async function inviteMembersAction(
  _previous: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  try {
    const result = await inviteMembersToCohort({
      cohortId: String(formData.get("cohortId")),
      emails: String(formData.get("emails")),
    });
    revalidatePath("/admin/invitations");
    return {
      ok: true,
      message: `สร้างคำเชิญ ${result.created} รายการ${result.duplicates ? ` · ซ้ำ ${result.duplicates}` : ""}`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "สร้างคำเชิญไม่สำเร็จ" };
  }
}
