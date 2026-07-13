"use client";

import { useActionState, useState } from "react";
import {
  issueCertificateAction,
  recalculateCompletionAction,
  type CertificateActionState,
} from "@/app/actions/certificates";
import type { AdminCompletionCandidate } from "@/lib/data/read-model";

const initialState: CertificateActionState = { ok: false, message: "" };

function CompletionRow({
  candidate,
  demo,
}: {
  candidate: AdminCompletionCandidate;
  demo: boolean;
}) {
  const [state, recalculate, pending] = useActionState(
    recalculateCompletionAction,
    initialState,
  );
  const [issueState, issue, issuing] = useActionState(
    issueCertificateAction,
    initialState,
  );
  const [demoIssued, setDemoIssued] = useState(candidate.certificateIssued);
  const canApprove =
    candidate.policy === "admin_approval" && candidate.status === "pending_approval";

  return (
    <div className="table-row certificate-admin-row">
      <strong>{candidate.learnerName}</strong>
      <span>{candidate.courseTitle}</span>
      <span>
        {candidate.lessonCompletionPercent} / {candidate.attendancePercent} /{" "}
        {candidate.assignmentPassPercent}
      </span>
      <span>
        <b className="status-badge" data-status={candidate.status === "completed" ? "confirmed" : undefined}>
          {demoIssued ? "ออกแล้ว" : candidate.status}
        </b>
      </span>
      <span className="admin-row-actions">
        {demo ? (
          <button type="button" onClick={() => setDemoIssued(true)}>
            {canApprove ? "อนุมัติและออกใบประกาศ" : "คำนวณและออกใบประกาศ"}
          </button>
        ) : (
          <>
            <form action={recalculate}>
              <input type="hidden" name="enrollmentId" value={candidate.enrollmentId} />
              <input type="hidden" name="approve" value={canApprove ? "true" : "false"} />
              <button type="submit" disabled={pending}>
                {pending ? "กำลังคำนวณ…" : canApprove ? "อนุมัติและออกใบประกาศ" : "คำนวณใหม่"}
              </button>
            </form>
            {candidate.status === "completed" && !candidate.certificateIssued && (
              <form action={issue}>
                <input type="hidden" name="enrollmentId" value={candidate.enrollmentId} />
                <button type="submit" disabled={issuing}>
                  {issuing ? "กำลังออก…" : "ออกใบประกาศ"}
                </button>
              </form>
            )}
          </>
        )}
        {(state.message || issueState.message) && (
          <small className="action-message" data-success={state.ok || issueState.ok}>
            {state.message || issueState.message}
          </small>
        )}
      </span>
    </div>
  );
}

export function CompletionBoard({
  candidates,
  demo,
}: {
  candidates: AdminCompletionCandidate[];
  demo: boolean;
}) {
  return (
    <div className="admin-table">
      <div className="table-row certificate-admin-row table-head">
        <span>ผู้เรียน</span><span>หลักสูตร</span><span>บท / เข้าเรียน / งาน</span><span>สถานะ</span><span>การทำงาน</span>
      </div>
      {candidates.map((candidate) => (
        <CompletionRow key={candidate.enrollmentId} candidate={candidate} demo={demo} />
      ))}
      {candidates.length === 0 && <p className="empty-note">ยังไม่มี enrollment ที่ต้องประเมิน</p>}
    </div>
  );
}
