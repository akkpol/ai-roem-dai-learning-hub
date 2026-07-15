"use client";

import { useActionState, useState, type FormEvent } from "react";
import { ChatCircleDots, Megaphone, PushPin, SealCheck } from "@phosphor-icons/react";
import { createThreadAction, replyThreadAction, type CommunityActionState } from "@/app/actions/community";
import type { CommunityView } from "@/lib/data/community-read-model";

const initial: CommunityActionState = { ok: false, message: "" };

export function CohortCommunity({ cohortId, community, demo }: { cohortId: string; community: CommunityView; demo: boolean }) {
  const [threadState, createThread, creating] = useActionState(createThreadAction, initial);
  const [replyState, replyThread, replying] = useActionState(replyThreadAction, initial);
  const [demoMessage, setDemoMessage] = useState("");
  const demoSubmit = demo ? (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setDemoMessage("บันทึกในชุมชนโหมดตัวอย่างแล้ว"); } : undefined;
  return <section className="cohort-community" aria-labelledby="community-title"><div className="section-title-row"><div><p className="eyebrow">COHORT COMMUNITY</p><h2 id="community-title">ประกาศและ Q&A ของรุ่นนี้</h2></div></div>{community.announcements.map((announcement) => <article className="cohort-announcement" key={announcement.id}><Megaphone aria-hidden="true" /><div><span>{announcement.pinned && <><PushPin /> ปักหมุด</>}</span><h3>{announcement.title}</h3><p>{announcement.body}</p></div></article>)}<div className="community-grid"><div className="thread-list">{community.threads.map((thread) => <article key={thread.id} data-status={thread.status}>{thread.pinned && <PushPin aria-label="ปักหมุด" />}<div><span>{thread.status === "resolved" && <><SealCheck /> ตอบแล้ว</>}</span><h3>{thread.title}</h3><p>{thread.body}</p><small>{thread.authorName} · {thread.replyCount} คำตอบ</small><form action={replyThread} onSubmit={demoSubmit}><input type="hidden" name="cohortId" value={cohortId} /><input type="hidden" name="threadId" value={thread.id} /><label><span className="sr-only">ตอบกระทู้ {thread.title}</span><input name="body" required minLength={1} placeholder={thread.status === "locked" ? "กระทู้ถูกล็อก" : "เขียนคำตอบ"} disabled={thread.status === "locked"} /></label><button type="submit" disabled={replying || thread.status === "locked"}>ตอบ</button></form></div></article>)}</div><form className="new-thread-form" action={createThread} onSubmit={demoSubmit}><ChatCircleDots aria-hidden="true" /><h3>ตั้งคำถามใหม่</h3><input type="hidden" name="cohortId" value={cohortId} /><label>หัวข้อ<input name="title" required minLength={3} /></label><label>รายละเอียด<textarea name="body" required minLength={3} rows={5} /></label><button type="submit" disabled={creating}>เผยแพร่คำถาม</button></form></div>{(demoMessage || threadState.message || replyState.message) && <p className="action-message" data-success={demo || threadState.ok || replyState.ok}>{demoMessage || threadState.message || replyState.message}</p>}</section>;
}
