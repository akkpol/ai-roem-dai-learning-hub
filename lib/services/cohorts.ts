import { and, asc, count, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  cohortStatusHistory,
  cohorts,
  courseInvites,
  enrollments,
  notificationOutbox,
  profiles,
  seatReservations,
} from "@/db/schema";
import { requireAdmin, requireMember } from "@/lib/auth/authorization";
import {
  confirmCohort,
  evaluateCohort,
  reserveSeat,
  withdrawReservation as evaluateWithdrawal,
} from "@/lib/domain/cohort";

const cohortIdSchema = z.string().uuid();

function notificationPayload(to: string, subject: string, text: string) {
  return { to, subject, text };
}

export async function reserveInvitedSeat(rawCohortId: string) {
  const cohortId = cohortIdSchema.parse(rawCohortId);
  const member = await requireMember();
  if (!member.emailVerified) {
    throw new Error("กรุณายืนยันอีเมลก่อนจองที่นั่ง");
  }

  return getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, cohortId))
      .for("update")
      .limit(1);
    if (!cohort) throw new Error("ไม่พบรุ่นเรียนนี้");

    const [invite] = await tx
      .select()
      .from(courseInvites)
      .where(
        and(
          eq(courseInvites.cohortId, cohortId),
          sql`lower(${courseInvites.email}) = lower(${member.email})`,
          inArray(courseInvites.status, ["pending", "accepted"]),
        ),
      )
      .limit(1);
    if (!invite || invite.expiresAt.getTime() <= Date.now()) {
      throw new Error("คำเชิญไม่ถูกต้องหรือหมดอายุแล้ว");
    }

    const [existing] = await tx
      .select()
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.cohortId, cohortId),
          eq(seatReservations.userId, member.userId),
          inArray(seatReservations.status, ["active", "waitlisted"]),
        ),
      )
      .limit(1);
    if (existing) {
      return { reservationId: existing.id, status: existing.status, idempotent: true };
    }

    const [{ value: activeReservations }] = await tx
      .select({ value: count() })
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.cohortId, cohortId),
          eq(seatReservations.status, "active"),
        ),
      );

    const decision = reserveSeat({
      status: cohort.status,
      activeReservations,
      maximumEnrollment: cohort.maximumEnrollment,
    });
    if (decision === "closed") throw new Error("รุ่นนี้ปิดรับการจองแล้ว");

    const [reservation] = await tx
      .insert(seatReservations)
      .values({
        cohortId,
        inviteId: invite.id,
        userId: member.userId,
        status: decision === "reserved" ? "active" : "waitlisted",
        proposedStartsAt: cohort.startsAt,
        expiresAt: cohort.registrationDeadlineAt,
      })
      .returning();

    await tx
      .update(courseInvites)
      .set({
        status: "accepted",
        acceptedByUserId: member.userId,
        acceptedAt: new Date(),
      })
      .where(eq(courseInvites.id, invite.id));

    await tx
      .insert(notificationOutbox)
      .values({
        type: "reservation_received",
        recipientEmail: member.email,
        dedupeKey: `reservation-received:${reservation.id}`,
        payload: notificationPayload(
          member.email,
          decision === "reserved" ? "รับคำจองแล้ว" : "เพิ่มคุณในรายชื่อสำรองแล้ว",
          decision === "reserved"
            ? "การจองนี้ยังไม่ใช่การยืนยันเปิดคลาสและไม่มีค่าใช้จ่าย เราจะแจ้งอีกครั้งเมื่อทีมงานยืนยัน"
            : "รุ่นนี้เต็มแล้ว เราจะแจ้งเมื่อมีที่นั่งว่าง",
        ),
      })
      .onConflictDoNothing({ target: notificationOutbox.dedupeKey });

    if (decision === "reserved") {
      const next = evaluateCohort({
        status: cohort.status,
        minimumEnrollment: cohort.minimumEnrollment,
        activeReservations: activeReservations + 1,
        registrationDeadlineAt: cohort.registrationDeadlineAt,
        thresholdReachedAt: cohort.thresholdReachedAt,
        now: new Date(),
      });

      if (next.status !== cohort.status) {
        await tx
          .update(cohorts)
          .set({
            status: next.status,
            thresholdReachedAt: next.thresholdReachedAt,
            updatedAt: new Date(),
          })
          .where(eq(cohorts.id, cohort.id));
        await tx.insert(cohortStatusHistory).values({
          cohortId,
          fromStatus: cohort.status,
          toStatus: next.status,
          reason: "enrollment_threshold_reached",
        });

        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
        if (next.status === "threshold_met" && adminEmail) {
          await tx
            .insert(notificationOutbox)
            .values({
              type: "threshold_met_admin",
              recipientEmail: adminEmail,
              dedupeKey: `threshold-met-admin:${cohort.id}`,
              payload: notificationPayload(
                adminEmail,
                "รุ่นเรียนถึงจำนวนขั้นต่ำแล้ว",
                `${cohort.title} ถึงเกณฑ์แล้ว กรุณาตรวจตาราง ผู้สอน และต้นทุนก่อนยืนยันเปิดคลาส`,
              ),
            })
            .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
        }

        if (next.status === "threshold_met") {
          const recipients = await tx
            .select({ userId: seatReservations.userId, email: profiles.email })
            .from(seatReservations)
            .innerJoin(profiles, eq(profiles.userId, seatReservations.userId))
            .where(
              and(
                eq(seatReservations.cohortId, cohort.id),
                eq(seatReservations.status, "active"),
              ),
            );
          for (const recipient of recipients) {
            await tx
              .insert(notificationOutbox)
              .values({
                type: "threshold_met_learner",
                recipientEmail: recipient.email,
                dedupeKey: `threshold-met-learner:${cohort.id}:${recipient.userId}`,
                payload: notificationPayload(
                  recipient.email,
                  "รุ่นเรียนถึงจำนวนขั้นต่ำแล้ว",
                  `${cohort.title} ถึงเกณฑ์แล้ว ขณะนี้กำลังรอทีมงานตรวจตาราง ผู้สอน และยืนยันเปิดคลาส`,
                ),
              })
              .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
          }
        }
      }
    }

    return { reservationId: reservation.id, status: reservation.status, idempotent: false };
  });
}

export async function confirmCohortByAdmin(input: {
  cohortId: string;
  overrideReason?: string;
}) {
  const parsed = z
    .object({ cohortId: cohortIdSchema, overrideReason: z.string().trim().max(500).optional() })
    .parse(input);
  const admin = await requireAdmin();

  return getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, parsed.cohortId))
      .for("update")
      .limit(1);
    if (!cohort) throw new Error("ไม่พบรุ่นเรียนนี้");

    const reservations = await tx
      .select({
        id: seatReservations.id,
        userId: seatReservations.userId,
        email: profiles.email,
      })
      .from(seatReservations)
      .innerJoin(profiles, eq(profiles.userId, seatReservations.userId))
      .where(
        and(
          eq(seatReservations.cohortId, cohort.id),
          eq(seatReservations.status, "active"),
        ),
      );

    const decision = confirmCohort({
      status: cohort.status,
      activeReservations: reservations.length,
      minimumEnrollment: cohort.minimumEnrollment,
      overrideReason: parsed.overrideReason,
    });
    if (!decision.changed) {
      return { changed: false, enrollmentsCreated: 0 };
    }

    const confirmedAt = new Date();
    await tx
      .update(cohorts)
      .set({
        status: "confirmed",
        confirmedAt,
        overrideReason: decision.usedOverride ? parsed.overrideReason : null,
        updatedAt: confirmedAt,
      })
      .where(eq(cohorts.id, cohort.id));

    for (const reservation of reservations) {
      await tx
        .insert(enrollments)
        .values({
          userId: reservation.userId,
          cohortId: cohort.id,
          reservationId: reservation.id,
        })
        .onConflictDoNothing({ target: enrollments.reservationId });
      await tx
        .update(seatReservations)
        .set({ status: "converted", convertedAt: confirmedAt, updatedAt: confirmedAt })
        .where(eq(seatReservations.id, reservation.id));
      await tx
        .insert(notificationOutbox)
        .values({
          type: "cohort_confirmed",
          recipientEmail: reservation.email,
          dedupeKey: `cohort-confirmed:${cohort.id}:${reservation.userId}`,
          payload: notificationPayload(
            reservation.email,
            "คลาสนี้เปิดแน่นอน",
            `${cohort.title} ได้รับการยืนยันแล้ว คุณจะเห็นรายละเอียดและลิงก์เรียนในหน้าการเรียนของฉัน`,
          ),
        })
        .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
    }

    await tx.insert(cohortStatusHistory).values({
      cohortId: cohort.id,
      fromStatus: cohort.status,
      toStatus: "confirmed",
      actorUserId: admin.userId,
      reason: decision.usedOverride ? parsed.overrideReason : "admin_confirmed_threshold",
    });
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: decision.usedOverride ? "cohort.confirm_below_threshold" : "cohort.confirm",
      entityType: "cohort",
      entityId: cohort.id,
      metadata: {
        activeReservations: reservations.length,
        minimumEnrollment: cohort.minimumEnrollment,
        overrideReason: parsed.overrideReason,
      },
    });

    return { changed: true, enrollmentsCreated: reservations.length };
  });
}

export async function withdrawSeatReservation(rawReservationId: string) {
  const reservationId = z.string().uuid().parse(rawReservationId);
  const member = await requireMember();

  return getDb().transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.id, reservationId),
          eq(seatReservations.userId, member.userId),
          eq(seatReservations.status, "active"),
        ),
      )
      .for("update")
      .limit(1);
    if (!reservation) throw new Error("ไม่พบคำจองที่ถอนออกได้");

    const [cohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, reservation.cohortId))
      .for("update")
      .limit(1);
    if (!cohort || !["collecting", "threshold_met"].includes(cohort.status)) {
      throw new Error("คลาสยืนยันแล้ว กรุณาติดต่อทีมงานเพื่อขอถอน enrollment");
    }

    const [{ value: activeBefore }] = await tx
      .select({ value: count() })
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.cohortId, cohort.id),
          eq(seatReservations.status, "active"),
        ),
      );
    const now = new Date();
    await tx
      .update(seatReservations)
      .set({ status: "withdrawn", withdrawnAt: now, updatedAt: now })
      .where(eq(seatReservations.id, reservation.id));

    const [waitlisted] = await tx
      .select()
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.cohortId, cohort.id),
          eq(seatReservations.status, "waitlisted"),
        ),
      )
      .orderBy(asc(seatReservations.reservedAt))
      .for("update", { skipLocked: true })
      .limit(1);

    let activeAfter = activeBefore - 1;
    if (waitlisted) {
      await tx
        .update(seatReservations)
        .set({ status: "active", updatedAt: now })
        .where(eq(seatReservations.id, waitlisted.id));
      activeAfter += 1;
      const [promotedProfile] = await tx
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.userId, waitlisted.userId))
        .limit(1);
      if (promotedProfile) {
        await tx
          .insert(notificationOutbox)
          .values({
            type: "waiting_list_promoted",
            recipientEmail: promotedProfile.email,
            dedupeKey: `waiting-list-promoted:${waitlisted.id}`,
            payload: notificationPayload(
              promotedProfile.email,
              "คุณได้ที่นั่งในรุ่นเรียนแล้ว",
              `${cohort.title} มีที่นั่งว่างและย้ายคำจองของคุณเข้ารุ่นแล้ว`,
            ),
          })
          .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
      }
    }

    const next = evaluateWithdrawal({
      status: cohort.status,
      activeReservationsBeforeWithdrawal: waitlisted ? activeAfter + 1 : activeBefore,
      minimumEnrollment: cohort.minimumEnrollment,
    });
    if (next.status !== cohort.status) {
      await tx
        .update(cohorts)
        .set({ status: next.status, thresholdReachedAt: null, updatedAt: now })
        .where(eq(cohorts.id, cohort.id));
      await tx.insert(cohortStatusHistory).values({
        cohortId: cohort.id,
        fromStatus: cohort.status,
        toStatus: next.status,
        actorUserId: member.userId,
        reason: "reservation_withdrawn_below_threshold",
      });
    }

    return { withdrawn: true, promotedFromWaitingList: Boolean(waitlisted) };
  });
}

export async function processCohortDeadlines(now = new Date()) {
  const candidates = await getDb()
    .select({ id: cohorts.id })
    .from(cohorts)
    .where(
      and(
        eq(cohorts.status, "collecting"),
        lte(cohorts.registrationDeadlineAt, now),
      ),
    );
  let postponed = 0;

  for (const candidate of candidates) {
    const changed = await getDb().transaction(async (tx) => {
      const [cohort] = await tx
        .select()
        .from(cohorts)
        .where(eq(cohorts.id, candidate.id))
        .for("update", { skipLocked: true })
        .limit(1);
      if (!cohort || cohort.status !== "collecting") return false;

      const [{ value: activeReservations }] = await tx
        .select({ value: count() })
        .from(seatReservations)
        .where(
          and(
            eq(seatReservations.cohortId, cohort.id),
            eq(seatReservations.status, "active"),
          ),
        );
      const next = evaluateCohort({
        status: cohort.status,
        minimumEnrollment: cohort.minimumEnrollment,
        activeReservations,
        registrationDeadlineAt: cohort.registrationDeadlineAt,
        thresholdReachedAt: cohort.thresholdReachedAt,
        now,
      });
      if (next.status !== "postponed") return false;

      await tx
        .update(cohorts)
        .set({ status: "postponed", postponedAt: now, updatedAt: now })
        .where(eq(cohorts.id, cohort.id));
      await tx.insert(cohortStatusHistory).values({
        cohortId: cohort.id,
        fromStatus: cohort.status,
        toStatus: "postponed",
        reason: "registration_deadline_below_threshold",
      });

      const recipients = await tx
        .select({ userId: seatReservations.userId, email: profiles.email })
        .from(seatReservations)
        .innerJoin(profiles, eq(profiles.userId, seatReservations.userId))
        .where(
          and(
            eq(seatReservations.cohortId, cohort.id),
            inArray(seatReservations.status, ["active", "waitlisted"]),
          ),
        );
      for (const recipient of recipients) {
        await tx
          .insert(notificationOutbox)
          .values({
            type: "cohort_postponed",
            recipientEmail: recipient.email,
            dedupeKey: `cohort-postponed:${cohort.id}:${recipient.userId}`,
            payload: notificationPayload(
              recipient.email,
              "รุ่นเรียนถูกเลื่อน",
              cohort.fallbackCohortId
                ? "รุ่นนี้ยังไม่ถึงจำนวนขั้นต่ำ กรุณาเข้าระบบเพื่อยืนยันวันใหม่ด้วยตัวเอง"
                : "รุ่นนี้ยังไม่ถึงจำนวนขั้นต่ำ เราจะแจ้งวันใหม่ให้ทราบ โดยจะไม่ย้ายคุณอัตโนมัติ",
            ),
          })
          .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
      }
      return true;
    });
    if (changed) postponed += 1;
  }

  return { scanned: candidates.length, postponed };
}

export async function queueCohortDeadlineReminders(now = new Date()) {
  const reminderCutoff = new Date(now.getTime() + 48 * 60 * 60 * 1_000);
  const rows = await getDb()
    .select({
      cohortId: cohorts.id,
      cohortTitle: cohorts.title,
      deadline: cohorts.registrationDeadlineAt,
      userId: seatReservations.userId,
      email: profiles.email,
    })
    .from(cohorts)
    .innerJoin(seatReservations, eq(seatReservations.cohortId, cohorts.id))
    .innerJoin(profiles, eq(profiles.userId, seatReservations.userId))
    .where(
      and(
        inArray(cohorts.status, ["collecting", "threshold_met"]),
        eq(seatReservations.status, "active"),
        lte(cohorts.registrationDeadlineAt, reminderCutoff),
        sql`${cohorts.registrationDeadlineAt} > ${now}`,
      ),
    );
  let queued = 0;
  for (const row of rows) {
    const [created] = await getDb()
      .insert(notificationOutbox)
      .values({
        type: "registration_deadline_reminder",
        recipientEmail: row.email,
        dedupeKey: `deadline-reminder:${row.cohortId}:${row.userId}`,
        payload: notificationPayload(
          row.email,
          "ใกล้ถึงกำหนดยืนยันรุ่นเรียน",
          `${row.cohortTitle} จะสรุปสถานะภายใน ${row.deadline.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}`,
        ),
      })
      .onConflictDoNothing({ target: notificationOutbox.dedupeKey })
      .returning({ id: notificationOutbox.id });
    if (created) queued += 1;
  }
  return { scanned: rows.length, queued };
}

export async function acceptFallbackCohort(rawOriginalCohortId: string) {
  const originalCohortId = cohortIdSchema.parse(rawOriginalCohortId);
  const member = await requireMember();

  return getDb().transaction(async (tx) => {
    const [originalCohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, originalCohortId))
      .for("update")
      .limit(1);
    if (
      !originalCohort ||
      originalCohort.status !== "postponed" ||
      !originalCohort.fallbackCohortId
    ) {
      throw new Error("รุ่นนี้ยังไม่มีวันใหม่ให้ยืนยัน");
    }
    const [originalReservation] = await tx
      .select()
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.cohortId, originalCohort.id),
          eq(seatReservations.userId, member.userId),
          inArray(seatReservations.status, ["active", "waitlisted"]),
        ),
      )
      .for("update")
      .limit(1);
    if (!originalReservation) throw new Error("ไม่พบคำจองเดิม");
    if (originalReservation.fallbackReservationId) {
      return { changed: false, reservationId: originalReservation.fallbackReservationId };
    }

    const [fallback] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, originalCohort.fallbackCohortId))
      .for("update")
      .limit(1);
    if (!fallback) throw new Error("ไม่พบรุ่นใหม่");
    const [originalInvite] = await tx
      .select()
      .from(courseInvites)
      .where(eq(courseInvites.id, originalReservation.inviteId))
      .limit(1);
    if (!originalInvite) throw new Error("ไม่พบคำเชิญเดิม");

    let [fallbackInvite] = await tx
      .insert(courseInvites)
      .values({
        cohortId: fallback.id,
        email: originalInvite.email,
        status: "accepted",
        invitedByUserId: originalInvite.invitedByUserId,
        acceptedByUserId: member.userId,
        expiresAt: fallback.registrationDeadlineAt,
        acceptedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (!fallbackInvite) {
      [fallbackInvite] = await tx
        .select()
        .from(courseInvites)
        .where(
          and(
            eq(courseInvites.cohortId, fallback.id),
            sql`lower(${courseInvites.email}) = lower(${member.email})`,
          ),
        )
        .limit(1);
    }

    const [{ value: activeReservations }] = await tx
      .select({ value: count() })
      .from(seatReservations)
      .where(
        and(
          eq(seatReservations.cohortId, fallback.id),
          eq(seatReservations.status, "active"),
        ),
      );
    const decision = reserveSeat({
      status: fallback.status,
      activeReservations,
      maximumEnrollment: fallback.maximumEnrollment,
    });
    if (decision === "closed") throw new Error("รุ่นใหม่ปิดรับแล้ว กรุณาติดต่อทีมงาน");

    const [created] = await tx
      .insert(seatReservations)
      .values({
        cohortId: fallback.id,
        inviteId: fallbackInvite.id,
        userId: member.userId,
        status: decision === "reserved" ? "active" : "waitlisted",
        proposedStartsAt: fallback.startsAt,
        expiresAt: fallback.registrationDeadlineAt,
      })
      .returning();
    await tx
      .update(seatReservations)
      .set({ status: "moved", fallbackReservationId: created.id, updatedAt: new Date() })
      .where(eq(seatReservations.id, originalReservation.id));
    await tx
      .insert(notificationOutbox)
      .values({
        type: "fallback_confirmed",
        recipientEmail: member.email,
        dedupeKey: `fallback-confirmed:${originalReservation.id}`,
        payload: notificationPayload(
          member.email,
          "ยืนยันวันเรียนใหม่แล้ว",
          `ย้ายคำจองของคุณไป ${fallback.title} แล้ว สถานะ: ${created.status}`,
        ),
      })
      .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
    return { changed: true, reservationId: created.id, status: created.status };
  });
}

export async function cancelConfirmedCohort(input: { cohortId: string; reason: string }) {
  const parsed = z
    .object({ cohortId: cohortIdSchema, reason: z.string().trim().min(10).max(500) })
    .parse(input);
  const admin = await requireAdmin();

  return getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select()
      .from(cohorts)
      .where(eq(cohorts.id, parsed.cohortId))
      .for("update")
      .limit(1);
    if (!cohort || cohort.status !== "confirmed") {
      throw new Error("ยกเลิกได้เฉพาะคลาสที่ยืนยันแล้ว");
    }

    const cancelledAt = new Date();
    await tx
      .update(cohorts)
      .set({
        status: "cancelled",
        cancellationReason: parsed.reason,
        cancelledAt,
        updatedAt: cancelledAt,
      })
      .where(eq(cohorts.id, cohort.id));
    await tx.insert(cohortStatusHistory).values({
      cohortId: cohort.id,
      fromStatus: "confirmed",
      toStatus: "cancelled",
      actorUserId: admin.userId,
      reason: parsed.reason,
    });
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: "cohort.cancel_confirmed",
      entityType: "cohort",
      entityId: cohort.id,
      metadata: { reason: parsed.reason },
    });
    const recipients = await tx
      .select({ userId: enrollments.userId, email: profiles.email })
      .from(enrollments)
      .innerJoin(profiles, eq(profiles.userId, enrollments.userId))
      .where(eq(enrollments.cohortId, cohort.id));
    for (const recipient of recipients) {
      await tx
        .insert(notificationOutbox)
        .values({
          type: "cohort_cancelled",
          recipientEmail: recipient.email,
          dedupeKey: `cohort-cancelled:${cohort.id}:${recipient.userId}`,
          payload: notificationPayload(
            recipient.email,
            "ทีมงานยกเลิกคลาส",
            `${cohort.title} ถูกยกเลิกด้วยเหตุจำเป็น: ${parsed.reason} ทีมงานจะติดต่อคุณโดยตรง`,
          ),
        })
        .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
    }
    return { cancelled: true };
  });
}
