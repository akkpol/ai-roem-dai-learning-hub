import { asc, count, desc, eq } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import {
  cohortAnnouncements,
  cohortThreadReplies,
  cohortThreads,
  profiles,
} from "@/db/schema";
import { canUseDemoData } from "./demo-policy";

export type CommunityView = {
  announcements: Array<{ id: string; title: string; body: string; pinned: boolean; publishedAt: Date }>;
  threads: Array<{ id: string; title: string; body: string; status: "open" | "resolved" | "locked"; pinned: boolean; authorName: string; replyCount: number; updatedAt: Date }>;
};

export async function getCommunityView(cohortId: string, demo = false): Promise<CommunityView> {
  if (canUseDemoData({ nodeEnv: process.env.NODE_ENV, demoRequested: demo })) return {
    announcements: [{ id: "announcement-1", title: "เตรียมตัวก่อนคลาสถัดไป", body: "ลองเลือกงาน 1 ชิ้นที่อยากใช้ AI ช่วย แล้วนำโจทย์มาแลกเปลี่ยนในห้องเรียน", pinned: true, publishedAt: new Date("2026-07-13T03:00:00.000Z") }],
    threads: [
      { id: "00000000-0000-4000-8000-000000000701", title: "ใช้ข้อมูลลูกค้ากับ AI ได้แค่ไหน?", body: "อยากทราบวิธีแยกข้อมูลที่ไม่ควรส่งเข้าโมเดล", status: "open", pinned: true, authorName: "ผู้เรียนในรุ่น", replyCount: 2, updatedAt: new Date("2026-07-14T02:00:00.000Z") },
      { id: "00000000-0000-4000-8000-000000000702", title: "ขอ checklist ตรวจ hallucination", body: "มีตัวอย่างสำหรับงานสรุปรายงานไหมครับ", status: "resolved", pinned: false, authorName: "ผู้เรียนในรุ่น", replyCount: 1, updatedAt: new Date("2026-07-13T09:00:00.000Z") },
    ],
  };
  if (!hasDatabaseConnection()) return { announcements: [], threads: [] };
  const db = getDb();
  const [announcements, threads] = await Promise.all([
    db.select({ id: cohortAnnouncements.id, title: cohortAnnouncements.title, body: cohortAnnouncements.body, pinned: cohortAnnouncements.pinned, publishedAt: cohortAnnouncements.publishedAt }).from(cohortAnnouncements).where(eq(cohortAnnouncements.cohortId, cohortId)).orderBy(desc(cohortAnnouncements.pinned), desc(cohortAnnouncements.publishedAt)),
    db.select({ id: cohortThreads.id, title: cohortThreads.title, body: cohortThreads.body, status: cohortThreads.status, pinned: cohortThreads.pinned, authorName: profiles.displayName, replyCount: count(cohortThreadReplies.id), updatedAt: cohortThreads.updatedAt }).from(cohortThreads).innerJoin(profiles, eq(profiles.userId, cohortThreads.authorUserId)).leftJoin(cohortThreadReplies, eq(cohortThreadReplies.threadId, cohortThreads.id)).where(eq(cohortThreads.cohortId, cohortId)).groupBy(cohortThreads.id, profiles.displayName).orderBy(desc(cohortThreads.pinned), asc(cohortThreads.status), desc(cohortThreads.updatedAt)),
  ]);
  return { announcements, threads: threads.map((thread) => ({ ...thread, authorName: "ผู้เรียนในรุ่น", replyCount: Number(thread.replyCount) })) };
}
