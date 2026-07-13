"use client";

import { useActionState, useState } from "react";
import {
  openCohortRegistrationAction,
  setFallbackCohortAction,
  updateCohortAction,
  type AdminOperationState,
} from "@/app/actions/admin-operations";
import {
  cancelCohortAction,
  confirmCohortAction,
  type CohortActionState,
} from "@/app/actions/cohorts";
import type { CohortCard } from "@/lib/data/read-model";
import { formatBangkokDateTime } from "@/lib/domain/datetime";

const initialState: CohortActionState = { ok: false, message: "" };
const initialOperationState: AdminOperationState = { ok: false, message: "" };

function dateTimeValue(value: Date) {
  return formatBangkokDateTime(new Date(value));
}

function AdminCohortCard({ cohort, demo, allCohorts }: { cohort: CohortCard; demo: boolean; allCohorts: CohortCard[] }) {
  const [state, action, pending] = useActionState(confirmCohortAction, initialState);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelCohortAction, initialState);
  const [editState, editAction, editing] = useActionState(updateCohortAction, initialOperationState);
  const [fallbackState, fallbackAction, fallbackPending] = useActionState(setFallbackCohortAction, initialOperationState);
  const [openState, openAction, opening] = useActionState(openCohortRegistrationAction, initialOperationState);
  const [demoConfirmed, setDemoConfirmed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [demoMessage, setDemoMessage] = useState("");
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
      {status === "draft" && (
        <form action={openAction} onSubmit={demo ? (event) => { event.preventDefault(); setDemoMessage("เปิดรับคำจองในโหมดตัวอย่างแล้ว"); } : undefined} className="admin-inline-form">
          <input type="hidden" name="cohortId" value={cohort.id} />
          <button type="submit" disabled={opening}>{opening ? "กำลังเปิดรับ…" : "เปิดรับคำจอง"}</button>
        </form>
      )}
      {(status === "threshold_met" || status === "collecting") && (
        demo ? (
          <div className="admin-inline-form">
            {belowThreshold && <input aria-label="เหตุผลเปิดต่ำกว่าเกณฑ์" placeholder="เหตุผลที่จำเป็นต้องเปิดต่ำกว่าเกณฑ์" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />}
            <button type="button" onClick={() => setDemoConfirmed(true)} disabled={belowThreshold && overrideReason.trim().length < 10}>ยืนยันเปิดคลาส</button>
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
      {!["confirmed", "in_progress", "completed", "cancelled"].includes(status) && (
        <details className="admin-control-panel">
          <summary>แก้วันและจำนวนรับ</summary>
          <form action={editAction} onSubmit={demo ? (event) => { event.preventDefault(); setDemoMessage("บันทึกการแก้ไขในโหมดตัวอย่างแล้ว"); } : undefined} className="admin-stack-form">
            <input type="hidden" name="cohortId" value={cohort.id} />
            <label>วันเริ่ม<input name="startsAt" type="datetime-local" defaultValue={dateTimeValue(cohort.startsAt)} required /></label>
            <label>เปิดรับ<input name="registrationOpensAt" type="datetime-local" defaultValue={dateTimeValue(cohort.registrationOpensAt)} required /></label>
            <label>ปิดรับ<input name="registrationDeadlineAt" type="datetime-local" defaultValue={dateTimeValue(cohort.registrationDeadlineAt)} required /></label>
            <label>ขั้นต่ำ<input name="minimumEnrollment" type="number" min="1" max="50" defaultValue={cohort.minimumEnrollment} required /></label>
            <label>สูงสุด<input name="maximumEnrollment" type="number" min="1" max="50" defaultValue={cohort.maximumEnrollment} required /></label>
            <button type="submit" disabled={editing}>{editing ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button>
          </form>
        </details>
      )}
      {!["confirmed", "in_progress", "completed", "cancelled"].includes(status) && (
        <form action={fallbackAction} onSubmit={demo ? (event) => { event.preventDefault(); setDemoMessage("กำหนดรุ่นถัดไปในโหมดตัวอย่างแล้ว"); } : undefined} className="admin-inline-form">
          <input type="hidden" name="cohortId" value={cohort.id} />
          <select name="fallbackCohortId" defaultValue={cohort.fallbackCohortId ?? ""} required aria-label="รุ่นถัดไป">
            <option value="">เลือกรุ่นถัดไป</option>
            {allCohorts.filter((candidate) => candidate.id !== cohort.id && candidate.courseId === cohort.courseId).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
          </select>
          <button type="submit" disabled={fallbackPending}>{fallbackPending ? "กำลังบันทึก…" : "กำหนดรุ่นถัดไป"}</button>
        </form>
      )}
      {status === "confirmed" && (
        <form action={cancelAction} onSubmit={demo ? (event) => { event.preventDefault(); setDemoMessage("บันทึกการยกเลิกพร้อมเหตุผลในโหมดตัวอย่างแล้ว"); } : undefined} className="admin-inline-form danger-form">
          <input type="hidden" name="cohortId" value={cohort.id} />
          <input name="reason" minLength={10} required placeholder="เหตุผลจำเป็นในการยกเลิก" />
          <button type="submit" disabled={cancelling}>{cancelling ? "กำลังยกเลิก…" : "ยกเลิกคลาสพร้อม audit"}</button>
        </form>
      )}
      {(state.message || cancelState.message || editState.message || fallbackState.message || openState.message || demoMessage) && <p className="action-message" data-success={state.ok || cancelState.ok || editState.ok || fallbackState.ok || openState.ok || Boolean(demoMessage)}>{state.message || cancelState.message || editState.message || fallbackState.message || openState.message || demoMessage}</p>}
    </article>
  );
}

export function CohortBoard({ cohorts, demo }: { cohorts: CohortCard[]; demo: boolean }) {
  return <div className="admin-cohort-grid">{cohorts.map((cohort) => <AdminCohortCard key={cohort.id} cohort={cohort} demo={demo} allCohorts={cohorts} />)}</div>;
}
