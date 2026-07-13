"use client";

import { useActionState, useState } from "react";
import { confirmCohortAction, type CohortActionState } from "@/app/actions/cohorts";
import type { CohortCard } from "@/lib/data/read-model";

const initialState: CohortActionState = { ok: false, message: "" };

function AdminCohortCard({ cohort, demo }: { cohort: CohortCard; demo: boolean }) {
  const [state, action, pending] = useActionState(confirmCohortAction, initialState);
  const [demoConfirmed, setDemoConfirmed] = useState(false);
  const status = demoConfirmed ? "confirmed" : cohort.status;
  const belowThreshold = cohort.activeReservations < cohort.minimumEnrollment;

  return (
    <article className="admin-cohort-card">
      <div className="admin-card-heading">
        <div>
          <span className="status-badge" data-status={status}>{status}</span>
          <h3>{cohort.title}</h3>
        </div>
        <strong>{cohort.activeReservations}/{cohort.minimumEnrollment}</strong>
      </div>
      <div className="threshold-track"><span style={{ width: `${Math.min(100, (cohort.activeReservations / cohort.minimumEnrollment) * 100)}%` }} /></div>
      <p>เริ่ม {cohort.startsAt.toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" })} · สูงสุด {cohort.maximumEnrollment} คน</p>
      {cohort.waitlistedReservations > 0 && <p>Waiting list {cohort.waitlistedReservations} คน</p>}
      {(status === "threshold_met" || status === "collecting") && (
        demo ? (
          <div className="admin-inline-form">
            {belowThreshold && <input aria-label="เหตุผลเปิดต่ำกว่าเกณฑ์" placeholder="เหตุผลที่จำเป็นต้องเปิดต่ำกว่าเกณฑ์" />}
            <button type="button" onClick={() => setDemoConfirmed(true)} disabled={belowThreshold}>ยืนยันเปิดคลาส</button>
          </div>
        ) : (
          <form action={action} className="admin-inline-form">
            <input type="hidden" name="cohortId" value={cohort.id} />
            {belowThreshold && <input name="overrideReason" required minLength={10} placeholder="เหตุผลเปิดต่ำกว่าเกณฑ์" />}
            <button type="submit" disabled={pending}>{pending ? "กำลังยืนยัน…" : "ยืนยันเปิดคลาส"}</button>
          </form>
        )
      )}
      {status === "confirmed" && <p className="success-note">สร้าง enrollment แล้ว · meeting link เปิดให้เฉพาะสมาชิกในรุ่น</p>}
      {state.message && <p className="action-message" data-success={state.ok}>{state.message}</p>}
    </article>
  );
}

export function CohortBoard({ cohorts, demo }: { cohorts: CohortCard[]; demo: boolean }) {
  return <div className="admin-cohort-grid">{cohorts.map((cohort) => <AdminCohortCard key={cohort.id} cohort={cohort} demo={demo} />)}</div>;
}
