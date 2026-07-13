"use client";

import { useActionState, useState } from "react";
import { inviteMembersAction, type InviteActionState } from "@/app/actions/invitations";
import type { CohortCard } from "@/lib/data/read-model";

const initialState: InviteActionState = { ok: false, message: "" };

export function InviteForm({ cohorts, demo }: { cohorts: CohortCard[]; demo: boolean }) {
  const [state, action, pending] = useActionState(inviteMembersAction, initialState);
  const [demoMessage, setDemoMessage] = useState("");
  return (
    <form
      action={demo ? undefined : action}
      className="invite-form"
      onSubmit={demo ? (event) => { event.preventDefault(); setDemoMessage("ตรวจรูปแบบและสร้างคำเชิญตัวอย่างแล้ว 2 รายการ"); } : undefined}
    >
      <label>รุ่นเรียน<select name="cohortId" required>{cohorts.filter((cohort) => cohort.status === "draft" || cohort.status === "collecting").map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.title}</option>)}</select></label>
      <label>อีเมล (บรรทัดละ 1 รายการ สูงสุด 50)<textarea name="emails" rows={5} required placeholder={"learner1@gmail.com\nlearner2@gmail.com"} /></label>
      <button type="submit" disabled={pending}>{pending ? "กำลังสร้าง…" : "ตรวจและสร้างคำเชิญ"}</button>
      {(state.message || demoMessage) && <p className="action-message" data-success={state.ok || Boolean(demoMessage)}>{demoMessage || state.message}</p>}
    </form>
  );
}
