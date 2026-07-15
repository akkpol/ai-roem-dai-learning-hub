"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle,
  Eye,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  createRevisionAction,
  saveRevisionAction,
  submitRevisionAction,
  type CourseStudioActionState,
} from "@/app/actions/course-studio";
import type { CourseStudioView } from "@/lib/data/course-studio-read-model";

const initialState: CourseStudioActionState = { ok: false, message: "" };

export function CourseStudio({ studio, demo }: { studio: CourseStudioView; demo: boolean }) {
  const [saveState, saveAction, saving] = useActionState(saveRevisionAction, initialState);
  const [submitState, submitAction, submitting] = useActionState(submitRevisionAction, initialState);
  const [demoMessage, setDemoMessage] = useState("");
  const demoSubmit = demo
    ? (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setDemoMessage("บันทึกในโหมดตัวอย่างแล้ว");
      }
    : undefined;

  if (!studio.revision) {
    return (
      <main className="studio-empty">
        <h1>{studio.courseTitle}</h1>
        <p>ยังไม่มี revision สำหรับแก้ไข</p>
        <form action={createRevisionAction} onSubmit={demoSubmit}>
          <input type="hidden" name="courseId" value={studio.courseId} />
          <button type="submit">สร้าง revision แรก</button>
        </form>
      </main>
    );
  }

  const editable = studio.revision.status === "draft" || studio.revision.status === "changes_requested";
  return (
    <main className="course-studio-page">
      <header className="studio-header">
        <Link href="/teach"><ArrowLeft /> กลับหน้าผู้สอน</Link>
        <div><p>COURSE STUDIO</p><h1>{studio.courseTitle}</h1></div>
        <span data-status={studio.revision.status}>Revision {studio.revision.revisionNumber} · {studio.revision.status}</span>
      </header>
      <div className="course-studio-grid">
        <aside className="curriculum-outline">
          <h2>โครงสร้างคอร์ส</h2>
          {studio.modules.map((module, moduleIndex) => (
            <section key={module.id}>
              <div><strong>{module.title}</strong><span><button type="button" aria-label={`เลื่อน ${module.title} ขึ้น`} disabled={!editable || moduleIndex === 0}><ArrowUp /></button><button type="button" aria-label={`เลื่อน ${module.title} ลง`} disabled={!editable || moduleIndex === studio.modules.length - 1}><ArrowDown /></button></span></div>
              {module.lessons.map((lesson) => <button type="button" className="outline-lesson" key={lesson.id}><FileText /> {lesson.title}</button>)}
            </section>
          ))}
          <button type="button" className="outline-add" disabled={!editable}>+ เพิ่ม module</button>
        </aside>

        <section className="studio-editor">
          <div className="studio-editor-title"><div><p>รายละเอียด revision</p><h2>ภาพรวมหลักสูตร</h2></div><button type="button"><Eye /> Preview แบบผู้เรียน</button></div>
          <form action={saveAction} onSubmit={demoSubmit}>
            <input type="hidden" name="revisionId" value={studio.revision.id} />
            <input type="hidden" name="expectedVersion" value={studio.revision.version} />
            <label>ชื่อคอร์ส<input name="title" defaultValue={studio.revision.title} disabled={!editable} /></label>
            <label>คำอธิบาย<textarea name="summary" defaultValue={studio.revision.summary} rows={8} disabled={!editable} /></label>
            <div className="studio-save-row"><span>Version {studio.revision.version} · autosave พร้อมใช้งาน</span><button type="submit" disabled={!editable || saving}>{saving ? "กำลังบันทึก…" : "บันทึก revision"}</button></div>
            {(demoMessage || saveState.message) && <p className="action-message" data-success={demo || saveState.ok}>{demoMessage || saveState.message}</p>}
          </form>
        </section>

        <aside className="studio-review-rail">
          <h2>ความพร้อมก่อนส่งตรวจ</h2>
          {studio.validationIssues.length ? studio.validationIssues.map((issue) => <p className="studio-issue" key={issue}><WarningCircle /> {issue}</p>) : <p className="studio-ready"><CheckCircle /> เนื้อหาพร้อมส่งตรวจ</p>}
          {studio.revision.reviewNotes && <section><strong>ข้อความจากแอดมิน</strong><p>{studio.revision.reviewNotes}</p></section>}
          <form action={submitAction} onSubmit={demoSubmit}>
            <input type="hidden" name="revisionId" value={studio.revision.id} />
            <button type="submit" disabled={!editable || studio.validationIssues.length > 0 || submitting}>{submitting ? "กำลังส่ง…" : "ส่งให้แอดมินตรวจ"}</button>
            {submitState.message && <p className="action-message" data-success={submitState.ok}>{submitState.message}</p>}
          </form>
          <small>Revision ที่อนุมัติแล้วจะถูกตรึงและแก้ไขไม่ได้ รุ่นเรียนเดิมยังเห็น snapshot เดิม</small>
        </aside>
      </div>
    </main>
  );
}
