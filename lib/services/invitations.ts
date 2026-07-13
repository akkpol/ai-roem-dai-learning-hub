import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cohorts, courseInvites, notificationOutbox } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/authorization";
import { normalizeInviteEmails } from "@/lib/domain/invitations";

export async function inviteMembersToCohort(input: { cohortId: string; emails: string }) {
  const cohortId = z.string().uuid().parse(input.cohortId);
  const emails = normalizeInviteEmails(input.emails);
  if (emails.length === 0) throw new Error("กรุณาใส่อีเมลอย่างน้อย 1 รายการ");
  const admin = await requireAdmin();

  return getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, cohortId))
      .for("update")
      .limit(1);
    if (!cohort) throw new Error("ไม่พบรุ่นเรียนนี้");
    if (![`draft`, `collecting`].includes(cohort.status)) {
      throw new Error("เพิ่มคำเชิญได้เฉพาะรุ่นที่ยังไม่ยืนยันเปิด");
    }

    const [{ value: existingCount }] = await tx
      .select({ value: count() })
      .from(courseInvites)
      .where(eq(courseInvites.cohortId, cohort.id));
    if (existingCount + emails.length > 50) {
      throw new Error(`รุ่นนี้เหลือสิทธิ์เชิญอีก ${Math.max(0, 50 - existingCount)} คน`);
    }

    let created = 0;
    for (const email of emails) {
      const [invite] = await tx
        .insert(courseInvites)
        .values({
          cohortId: cohort.id,
          email,
          invitedByUserId: admin.userId,
          expiresAt: cohort.registrationDeadlineAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!invite) continue;
      created += 1;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await tx
        .insert(notificationOutbox)
        .values({
          type: "course_invite",
          recipientEmail: email,
          dedupeKey: `course-invite:${invite.id}`,
          payload: {
            to: email,
            subject: `คำเชิญเข้าร่วม ${cohort.title}`,
            text: `คุณได้รับคำเชิญให้จอง ${cohort.title} เข้าสู่ระบบด้วยอีเมลนี้ที่ ${appUrl}/auth/sign-in การจองยังไม่มีค่าใช้จ่ายและยังไม่ใช่การยืนยันเปิดคลาส`,
          },
        })
        .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
    }
    return { requested: emails.length, created, duplicates: emails.length - created };
  });
}
