"use client";

import { useActionState, useState, type FormEvent } from "react";
import { reviewRevisionAction, type CourseStudioActionState } from "@/app/actions/course-studio";

const initialState: CourseStudioActionState = { ok: false, message: "" };

export function ReviewQueue({
  queue,
  demo,
}: {
  queue: Array<{ id: string; courseTitle: string; revisionNumber: number; submittedAt: Date | null }>;
  demo: boolean;
}) {
  const [state, action, pending] = useActionState(reviewRevisionAction, initialState);
  const [demoMessage, setDemoMessage] = useState("");
  const onSubmit = demo ? (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setDemoMessage("บันทึกผลตรวจในโหมดตัวอย่างแล้ว"); } : undefined;
  if (!queue.length) return <p className="empty-note">ไม่มี revision รอตรวจ</p>;
  return <section className="review-queue">{queue.map((item) => <article key={item.id}><div><span>Revision {item.revisionNumber}</span><h2>{item.courseTitle}</h2><p>ส่งเมื่อ {item.submittedAt?.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) ?? "—"}</p></div><form action={action} onSubmit={onSubmit}><input type="hidden" name="revisionId" value={item.id} /><label>เหตุผลเมื่อส่งกลับ<textarea name="notes" rows={3} /></label><div><button name="decision" value="changes_requested" disabled={pending}>ส่งกลับแก้</button><button name="decision" value="approved" disabled={pending}>อนุมัติ revision</button></div></form></article>)}{(demoMessage || state.message) && <p className="action-message" data-success={demo || state.ok}>{demoMessage || state.message}</p>}</section>;
}
