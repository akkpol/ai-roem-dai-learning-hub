"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  acceptFallbackAction,
  withdrawReservationAction,
  type CohortActionState,
} from "@/app/actions/cohorts";
import type { ReservationSummary } from "@/lib/data/read-model";

const initialState: CohortActionState = { ok: false, message: "" };

function ReservationCard({ reservation }: { reservation: ReservationSummary }) {
  const [state, action, pending] = useActionState(acceptFallbackAction, initialState);
  const [withdrawState, withdrawAction, withdrawing] = useActionState(withdrawReservationAction, initialState);
  const postponed = reservation.cohortStatus === "postponed";

  return (
    <article className="enrollment-card reservation-summary-card">
      <span className="status-badge" data-status={reservation.cohortStatus}>
        {postponed
          ? "เลื่อนรุ่น — รอยืนยันวันใหม่"
          : reservation.reservationStatus === "waitlisted"
            ? "รายชื่อสำรอง"
            : "กำลังรวมผู้เรียน"}
      </span>
      <h2>{reservation.courseTitle}</h2>
      <p>{reservation.cohortTitle}</p>
      <div className="enrollment-date">
        เริ่ม {reservation.startsAt.toLocaleDateString("th-TH", {
          dateStyle: "medium",
          timeZone: "Asia/Bangkok",
        })}
      </div>
      {postponed && reservation.hasFallback ? (
        <form action={action}>
          <input type="hidden" name="cohortId" value={reservation.cohortId} />
          <button className="primary-cta" type="submit" disabled={pending}>
            {pending ? "กำลังยืนยัน…" : "ยืนยันย้ายไปรุ่นใหม่"}
          </button>
        </form>
      ) : (
        <Link className="primary-cta link-cta" href={`/courses/${reservation.courseSlug}`}>
          ดูรายละเอียดรุ่น
        </Link>
      )}
      {!postponed && ["active", "waitlisted"].includes(reservation.reservationStatus) && (
        <form action={withdrawAction}>
          <input type="hidden" name="reservationId" value={reservation.id} />
          <button type="submit" disabled={withdrawing}>{withdrawing ? "กำลังถอน…" : "ถอนคำจอง"}</button>
        </form>
      )}
      {state.message && (
        <p className="action-message" data-success={state.ok} aria-live="polite">
          {state.message}
        </p>
      )}
      {withdrawState.message && (
        <p className="action-message" data-success={withdrawState.ok} aria-live="polite">
          {withdrawState.message}
        </p>
      )}
    </article>
  );
}

export function LearnerReservations({ reservations }: { reservations: ReservationSummary[] }) {
  if (reservations.length === 0) return null;
  return (
    <section className="pending-reservations" aria-labelledby="pending-reservations-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RESERVATIONS</p>
          <h2 id="pending-reservations-title">คำจองที่ยังไม่เป็น enrollment</h2>
          <p>รุ่นที่เลื่อนจะไม่ย้ายคุณอัตโนมัติ ต้องกดยืนยันวันใหม่ด้วยตัวเอง</p>
        </div>
      </div>
      <div className="enrollment-grid">
        {reservations.map((reservation) => (
          <ReservationCard key={reservation.id} reservation={reservation} />
        ))}
      </div>
    </section>
  );
}
