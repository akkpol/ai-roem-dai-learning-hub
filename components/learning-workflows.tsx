"use client";

import { useActionState } from "react";
import {
  submitAssignmentAction,
  updateLessonProgressAction,
  type LearningActionState,
} from "@/app/actions/learning";
import type { EnrollmentDetail } from "@/lib/data/read-model";

const initialState: LearningActionState = { ok: false, message: "" };

export function LearningWorkflows({
  enrollmentId,
  lessons,
  assignments,
  demo,
}: {
  enrollmentId: string;
  lessons: EnrollmentDetail["lessons"];
  assignments: EnrollmentDetail["assignments"];
  demo: boolean;
}) {
  const [lessonState, lessonAction, updatingLesson] = useActionState(updateLessonProgressAction, initialState);
  const [submissionState, submissionAction, submitting] = useActionState(submitAssignmentAction, initialState);

  return (
    <>
      <div className="lesson-list">
        {lessons.map((lesson, index) => (
          <article key={lesson.id}>
            <span className="lesson-index">{index + 1}</span>
            <div><h3>{lesson.title}</h3><div className="mini-progress"><span style={{ width: `${lesson.progressPercent}%` }} /></div></div>
            {lesson.recordingUrl && <a href={lesson.recordingUrl} target="_blank" rel="noreferrer">เปิด YouTube Private</a>}
            {demo ? <span>{lesson.progressPercent === 100 ? "เรียนแล้ว" : lesson.kind}</span> : (
              <form action={lessonAction}>
                <input type="hidden" name="enrollmentId" value={enrollmentId} />
                <input type="hidden" name="lessonId" value={lesson.id} />
                <input type="hidden" name="progressPercent" value={lesson.progressPercent === 100 ? 0 : 100} />
                <button type="submit" disabled={updatingLesson}>{lesson.progressPercent === 100 ? "ทำเครื่องหมายว่ายังไม่จบ" : "ทำเครื่องหมายว่าเรียนแล้ว"}</button>
              </form>
            )}
          </article>
        ))}
      </div>
      {lessonState.message && <p className="action-message" data-success={lessonState.ok}>{lessonState.message}</p>}

      <section className="assignment-panel">
        <p className="eyebrow">ASSIGNMENTS</p>
        <h2>งานที่ต้องส่ง</h2>
        {assignments.length === 0 ? <p>หลักสูตรนี้ไม่มีงานที่ต้องส่ง</p> : assignments.map((assignment) => (
          <article key={assignment.id}>
            <h3>{assignment.title}</h3>
            <p>{assignment.instructions}</p>
            <p>สถานะ: {assignment.status ?? "ยังไม่ส่ง"}{assignment.score !== null ? ` · ${assignment.score} คะแนน` : ""}</p>
            {assignment.feedback && <p>Feedback: {assignment.feedback}</p>}
            {!demo && (
              <form action={submissionAction} className="admin-inline-form">
                <input type="hidden" name="enrollmentId" value={enrollmentId} />
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <input name="submissionUrl" type="url" required defaultValue={assignment.submissionUrl ?? ""} placeholder="https:// ลิงก์งานของคุณ" />
                <button type="submit" disabled={submitting}>{submitting ? "กำลังส่ง…" : assignment.status ? "ส่งงานอีกครั้ง" : "ส่งงาน"}</button>
              </form>
            )}
          </article>
        ))}
        {submissionState.message && <p className="action-message" data-success={submissionState.ok}>{submissionState.message}</p>}
      </section>
    </>
  );
}
