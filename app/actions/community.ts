"use server";

import { revalidatePath } from "next/cache";
import {
  createAnnouncement,
  createThread,
  moderateThread,
  replyToThread,
} from "@/lib/services/community";

export type CommunityActionState = { ok: boolean; message: string };
const message = (error: unknown) => error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";

async function run(operation: () => Promise<unknown>, cohortId: string, success: string) {
  try {
    await operation();
    revalidatePath(`/teach/cohorts/${cohortId}`);
    revalidatePath("/learn");
    return { ok: true, message: success };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function createAnnouncementAction(_previous: CommunityActionState, formData: FormData) {
  const cohortId = String(formData.get("cohortId"));
  return run(() => createAnnouncement({ cohortId, title: String(formData.get("title")), body: String(formData.get("body")), pinned: formData.get("pinned") === "on" }), cohortId, "เผยแพร่ประกาศแล้ว");
}

export async function createThreadAction(_previous: CommunityActionState, formData: FormData) {
  const cohortId = String(formData.get("cohortId"));
  return run(() => createThread({ cohortId, title: String(formData.get("title")), body: String(formData.get("body")) }), cohortId, "ตั้งกระทู้แล้ว");
}

export async function replyThreadAction(_previous: CommunityActionState, formData: FormData) {
  const cohortId = String(formData.get("cohortId"));
  return run(() => replyToThread({ threadId: String(formData.get("threadId")), body: String(formData.get("body")) }), cohortId, "ตอบกระทู้แล้ว");
}

export async function moderateThreadAction(_previous: CommunityActionState, formData: FormData) {
  const cohortId = String(formData.get("cohortId"));
  return run(() => moderateThread({ threadId: String(formData.get("threadId")), action: String(formData.get("moderationAction")) as "pin" | "unpin" | "resolve" | "reopen" | "lock" }), cohortId, "อัปเดตสถานะกระทู้แล้ว");
}
