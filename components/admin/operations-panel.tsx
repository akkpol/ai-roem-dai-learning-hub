"use client";

import { useActionState, useState, type FormEvent } from "react";
import {
  createCohortAction,
  createCourseMaterialAction,
  createLiveSessionAction,
  recordAttendanceAction,
  reviewSubmissionAction,
  type AdminOperationState,
} from "@/app/actions/admin-operations";
import type { AdminOperationsData } from "@/lib/data/read-model";

const initialState: AdminOperationState = { ok: false, message: "" };

function useDemoSubmit(demo: boolean) {
  const [message, setMessage] = useState("");
  return {
    message,
    onSubmit: demo
      ? (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setMessage("บันทึกในโหมดตัวอย่างแล้ว");
        }
      : undefined,
  };
}

export function AdminOperationsPanel({ data, demo }: { data: AdminOperationsData; demo: boolean }) {
  const [cohortState, createCohort, creatingCohort] = useActionState(createCohortAction, initialState);
  const [sessionState, createSession, creatingSession] = useActionState(createLiveSessionAction, initialState);
  const [materialState, createMaterial, creatingMaterial] = useActionState(createCourseMaterialAction, initialState);
  const [attendanceState, recordAttendance, recordingAttendance] = useActionState(recordAttendanceAction, initialState);
  const [submissionState, reviewSubmission, reviewingSubmission] = useActionState(reviewSubmissionAction, initialState);
  const [materialKind, setMaterialKind] = useState<"document" | "worksheet" | "link">("document");
  const cohortDemo = useDemoSubmit(demo);
  const sessionDemo = useDemoSubmit(demo);
  const materialDemo = useDemoSubmit(demo);
  const attendanceDemo = useDemoSubmit(demo);
  const submissionDemo = useDemoSubmit(demo);

  return (
    <section className="admin-operations" aria-labelledby="admin-operations-title">
      <div className="page-heading"><div><p className="eyebrow">OPERATIONS</p><h2 id="admin-operations-title">ตั้งค่าการเรียนที่ใช้งานจริง</h2><p>ทุกคำสั่งตรวจ admin role และบันทึก audit ฝั่ง server</p></div></div>
      <div className="admin-operation-grid">
        <details open>
          <summary>สร้างรุ่นเรียน</summary>
          <form action={createCohort} onSubmit={cohortDemo.onSubmit} className="admin-stack-form">
            <label>หลักสูตร<select name="courseId" required><option value="">เลือกหลักสูตร</option>{data.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
            <label>ชื่อรุ่น<input name="title" required minLength={3} /></label>
            <label>เริ่มเรียน<input name="startsAt" type="datetime-local" required /></label>
            <label>จบเรียน<input name="endsAt" type="datetime-local" /></label>
            <label>เปิดรับ<input name="registrationOpensAt" type="datetime-local" required /></label>
            <label>ปิดรับ<input name="registrationDeadlineAt" type="datetime-local" required /></label>
            <label>ขั้นต่ำ<input name="minimumEnrollment" type="number" min="1" max="50" defaultValue="8" required /></label>
            <label>สูงสุด<input name="maximumEnrollment" type="number" min="1" max="50" defaultValue="16" required /></label>
            <button type="submit" disabled={creatingCohort}>{creatingCohort ? "กำลังสร้าง…" : "สร้างเป็น draft"}</button>
            <OperationMessage state={cohortState} demoMessage={cohortDemo.message} />
          </form>
        </details>

        <details>
          <summary>เพิ่ม Live session / Meet / Zoom</summary>
          <form action={createSession} onSubmit={sessionDemo.onSubmit} className="admin-stack-form">
            <label>รุ่น<select name="cohortId" required><option value="">เลือกรุ่น</option>{data.cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.title}</option>)}</select></label>
            <label>หัวข้อ<input name="title" required /></label>
            <label>เริ่ม<input name="startsAt" type="datetime-local" required /></label>
            <label>จบ<input name="endsAt" type="datetime-local" /></label>
            <label>เครื่องมือ<input name="meetingProvider" placeholder="Google Meet หรือ Zoom" /></label>
            <label>Meeting URL<input name="meetingUrl" type="url" placeholder="https://" /></label>
            <button type="submit" disabled={creatingSession}>{creatingSession ? "กำลังเพิ่ม…" : "เพิ่ม session"}</button>
            <OperationMessage state={sessionState} demoMessage={sessionDemo.message} />
          </form>
        </details>

        <details>
          <summary>เพิ่มเอกสารหรือลิงก์</summary>
          <form action={createMaterial} onSubmit={materialDemo.onSubmit} className="admin-stack-form">
            <label>หลักสูตร<select name="courseId" required><option value="">เลือกหลักสูตร</option>{data.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
            <label>ชื่อเอกสาร<input name="title" required /></label>
            <label>ชนิด<select name="kind" value={materialKind} onChange={(event) => setMaterialKind(event.target.value as typeof materialKind)}><option value="document">Document</option><option value="worksheet">Worksheet</option><option value="link">Link</option></select></label>
            {materialKind === "link"
              ? <label>URL<input name="externalUrl" type="url" required placeholder="https://" /></label>
              : <label>ไฟล์ private (สูงสุด 10 MB)<input name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" /></label>}
            <button type="submit" disabled={creatingMaterial}>{creatingMaterial ? "กำลังเพิ่ม…" : "เพิ่มเอกสาร"}</button>
            <OperationMessage state={materialState} demoMessage={materialDemo.message} />
          </form>
        </details>

        <details>
          <summary>บันทึก Attendance</summary>
          <form action={recordAttendance} onSubmit={attendanceDemo.onSubmit} className="admin-stack-form">
            <label>Enrollment<select name="enrollmentId" required><option value="">เลือกผู้เรียน</option>{data.enrollments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Session<select name="liveSessionId" required><option value="">เลือก session</option>{data.sessions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Attendance %<input name="attendancePercent" type="number" min="0" max="100" required /></label>
            <button type="submit" disabled={recordingAttendance}>{recordingAttendance ? "กำลังบันทึก…" : "บันทึก attendance"}</button>
            <OperationMessage state={attendanceState} demoMessage={attendanceDemo.message} />
          </form>
        </details>

        <details>
          <summary>ตรวจงาน</summary>
          <form action={reviewSubmission} onSubmit={submissionDemo.onSubmit} className="admin-stack-form">
            <label>งาน<select name="submissionId" required><option value="">เลือกงาน</option>{data.submissions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>คะแนน<input name="score" type="number" min="0" max="100" required /></label>
            <label>ผล<select name="status"><option value="approved">ผ่าน</option><option value="rejected">ให้แก้ไข</option></select></label>
            <label>Feedback<textarea name="feedback" maxLength={1000} /></label>
            <button type="submit" disabled={reviewingSubmission}>{reviewingSubmission ? "กำลังบันทึก…" : "บันทึกผลตรวจ"}</button>
            <OperationMessage state={submissionState} demoMessage={submissionDemo.message} />
          </form>
        </details>
      </div>
    </section>
  );
}

function OperationMessage({ state, demoMessage }: { state: AdminOperationState; demoMessage: string }) {
  const message = demoMessage || state.message;
  return message ? <p className="action-message" data-success={Boolean(demoMessage) || state.ok}>{message}</p> : null;
}
