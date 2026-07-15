"use client";

import { useActionState, useState, type FormEvent } from "react";
import { assignCohortInstructorAction, assignCourseAuthorAction, grantRoleAction, type AccessActionState } from "@/app/actions/access-management";

const initial: AccessActionState = { ok: false, message: "" };

export function AccessManager({ data, demo }: { data: Awaited<ReturnType<typeof import("@/lib/data/admin-studio-read-model").getAccessManagementData>>; demo: boolean }) {
  const [roleState, grantRole, rolePending] = useActionState(grantRoleAction, initial);
  const [courseState, assignCourse, coursePending] = useActionState(assignCourseAuthorAction, initial);
  const [cohortState, assignCohort, cohortPending] = useActionState(assignCohortInstructorAction, initial);
  const [demoMessage, setDemoMessage] = useState("");
  const onSubmit = demo ? (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setDemoMessage("บันทึกการมอบหมายในโหมดตัวอย่างแล้ว"); } : undefined;
  const instructors = data.members.filter((member) => member.roles.includes("instructor"));
  return <div className="access-manager"><section><h2>สมาชิกและบทบาท</h2>{data.members.map((member) => <article key={member.userId}><div><strong>{member.displayName}</strong><small>{member.email}</small></div><span>{member.roles.join(" · ") || "legacy role"}</span></article>)}<form action={grantRole} onSubmit={onSubmit}><label>สมาชิก<select name="userId">{data.members.map((member) => <option value={member.userId} key={member.userId}>{member.displayName}</option>)}</select></label><label>บทบาท<select name="role"><option value="instructor">ผู้สอน</option><option value="admin">แอดมิน</option></select></label><button disabled={rolePending}>ให้สิทธิ์</button></form></section><section><h2>มอบหมายงาน</h2><form action={assignCourse} onSubmit={onSubmit}><label>ผู้สอน<select name="userId">{instructors.map((member) => <option value={member.userId} key={member.userId}>{member.displayName}</option>)}</select></label><label>คอร์ส<select name="courseId">{data.courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label><button disabled={coursePending}>มอบหมายผู้เขียนคอร์ส</button></form><form action={assignCohort} onSubmit={onSubmit}><label>ผู้สอน<select name="userId">{instructors.map((member) => <option value={member.userId} key={member.userId}>{member.displayName}</option>)}</select></label><label>รุ่นเรียน<select name="cohortId">{data.cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.title}</option>)}</select></label><button disabled={cohortPending}>มอบหมายผู้สอนประจำรุ่น</button></form></section>{[demoMessage, roleState.message, courseState.message, cohortState.message].filter(Boolean).map((message) => <p className="action-message" data-success key={message}>{message}</p>)}</div>;
}
