"use client";

import { useActionState, useMemo, useState } from "react";
import { acceptFallbackAction, reserveSeatAction, type CohortActionState } from "@/app/actions/cohorts";
import type { CohortCard } from "@/lib/data/read-model";

const initialState: CohortActionState = { ok: false, message: "" };

function statusCopy(status: CohortCard["status"]) {
  if (status === "threshold_met") return "ถึงเกณฑ์แล้ว กำลังรอทีมงานยืนยัน";
  if (status === "payment_collecting") return "เปิดรอบชำระเงินแล้ว 48 ชั่วโมง";
  if (status === "confirmed") return "คลาสนี้เปิดแน่นอน";
  if (status === "postponed") return "กำลังเสนอวันเรียนใหม่";
  if (status === "cancelled") return "คลาสนี้ถูกยกเลิก";
  return "กำลังรวมผู้เรียน";
}

export function CohortReservationCard({
  cohort,
  courseSlug,
  demo,
}: {
  cohort: CohortCard;
  courseSlug: string;
  demo: boolean;
}) {
  const [actionState, formAction, pending] = useActionState(reserveSeatAction, initialState);
  const [fallbackState, fallbackAction, fallbackPending] = useActionState(acceptFallbackAction, initialState);
  const [demoReserved, setDemoReserved] = useState(false);
  const active = cohort.activeReservations + (demoReserved ? 1 : 0);
  const displayStatus =
    cohort.status === "collecting" && active >= cohort.minimumEnrollment
      ? "threshold_met"
      : cohort.status;
  const remaining = Math.max(0, cohort.minimumEnrollment - active);
  const progress = Math.min(100, (active / cohort.minimumEnrollment) * 100);
  const date = useMemo(
    () =>
      cohort.startsAt.toLocaleDateString("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Bangkok",
      }),
    [cohort.startsAt],
  );

  return (
    <aside className="reservation-card">
      <span className="status-badge" data-status={displayStatus}>{statusCopy(displayStatus)}</span>
      <h2>{cohort.title}</h2>
      <p className="cohort-date">เริ่มเรียน {date}</p>
      <div className="threshold-number">
        <strong>{active}/{cohort.minimumEnrollment}</strong>
        <span>คนเพื่อเปิดคลาส</span>
      </div>
      <div className="threshold-track" aria-label={`มีผู้จอง ${active} จากขั้นต่ำ ${cohort.minimumEnrollment} คน`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {remaining > 0 ? <p>ต้องการอีก <strong>{remaining} คน</strong> เพื่อถึงเกณฑ์</p> : <p>ครบจำนวนขั้นต่ำแล้ว รอทีมงานตรวจตารางและผู้สอน</p>}
      <dl className="cohort-facts">
        <div><dt>ยืนยันภายใน</dt><dd>{cohort.registrationDeadlineAt.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })}</dd></div>
        <div><dt>รับสูงสุด</dt><dd>{cohort.maximumEnrollment} คน</dd></div>
        {cohort.waitlistedReservations > 0 && <div><dt>รายชื่อสำรอง</dt><dd>{cohort.waitlistedReservations} คน</dd></div>}
      </dl>
      <p className="reservation-disclaimer">การจองนี้ยังไม่ใช่การยืนยันเปิดคลาสและไม่มีค่าใช้จ่าย</p>
      {(displayStatus === "collecting" || displayStatus === "threshold_met") && (
        demo ? (
          <button className="primary-cta" type="button" disabled={demoReserved} onClick={() => setDemoReserved(true)}>
            {demoReserved
              ? "รับคำจองแล้ว"
              : displayStatus === "threshold_met"
                ? "จองเพิ่มหรือเข้ารายชื่อสำรอง"
                : "จองวันที่นี้"}
          </button>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="cohortId" value={cohort.id} />
            <input type="hidden" name="courseSlug" value={courseSlug} />
            <button className="primary-cta" type="submit" disabled={pending}>
              {pending
                ? "กำลังตรวจสิทธิ์…"
                : displayStatus === "threshold_met"
                  ? "จองเพิ่มหรือเข้ารายชื่อสำรอง"
                  : "จองวันที่นี้"}
            </button>
          </form>
        )
      )}
      {displayStatus === "confirmed" && <LinkLike href="/learn">ไปที่การเรียนของฉัน</LinkLike>}
      {displayStatus === "postponed" && (demo ? <button className="primary-cta" type="button" onClick={() => setDemoReserved(true)}>ยืนยันย้ายไปรุ่นใหม่</button> : <form action={fallbackAction}><input type="hidden" name="cohortId" value={cohort.id} /><button className="primary-cta" type="submit" disabled={fallbackPending}>{fallbackPending ? "กำลังยืนยัน…" : "ยืนยันย้ายไปรุ่นใหม่"}</button></form>)}
      {(actionState.message || demoReserved) && (
        <p className="action-message" data-success={actionState.ok || demoReserved} aria-live="polite">
          {demoReserved ? (displayStatus === "postponed" ? "ยืนยันวันใหม่แล้ว" : "รับคำจองแล้ว เราจะแจ้งอีกครั้งเมื่อทีมงานยืนยัน") : actionState.message}
        </p>
      )}
      {fallbackState.message && <p className="action-message" data-success={fallbackState.ok}>{fallbackState.message}</p>}
    </aside>
  );
}

function LinkLike({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="primary-cta link-cta" href={href}>{children}</a>;
}
