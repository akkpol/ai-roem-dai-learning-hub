import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowSquareOut, FileText } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { LearningWorkflows } from "@/components/learning-workflows";
import { getCurrentMember } from "@/lib/auth/session";
import { getEnrollmentDetail } from "@/lib/data/read-model";

export const metadata: Metadata = { title: "ห้องเรียน" };
export const dynamic = "force-dynamic";

export default async function EnrollmentPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in?next=/learn");
  const enrollment = await getEnrollmentDetail((await params).enrollmentId, member.userId, member.role === "admin", member.demo);
  if (!enrollment) notFound();

  return (
    <AppShell active="learn">
      <main className="portal-main classroom-page">
        <Link className="back-link" href="/learn">← กลับไปการเรียนของฉัน</Link>
        <div className="classroom-hero">
          <div><p className="eyebrow">CONFIRMED COHORT</p><h1>{enrollment.courseTitle}</h1><p>{enrollment.cohortTitle}</p></div>
          {enrollment.meetingUrl && <a className="primary-cta link-cta" href={enrollment.meetingUrl} target="_blank" rel="noreferrer">เข้า {enrollment.meetingProvider ?? "ห้องเรียนสด"} <ArrowSquareOut /></a>}
        </div>
        <div className="classroom-grid">
          <section className="lesson-panel">
            <div className="section-title-row"><div><p className="eyebrow">LESSONS</p><h2>บทเรียนของรุ่นนี้</h2></div><b>{enrollment.progressPercent}%</b></div>
            <LearningWorkflows enrollmentId={enrollment.id} lessons={enrollment.lessons} assignments={enrollment.assignments} demo={member.demo} />
          </section>
          <aside className="classroom-sidebar">
            <section><p className="eyebrow">COMPLETION</p><h2>เกณฑ์จบหลักสูตร</h2><ul><li data-pass={enrollment.progressPercent === 100}>บทบังคับครบ <b>{enrollment.progressPercent}%</b></li><li data-pass={enrollment.attendancePercent >= 80}>Attendance <b>{enrollment.attendancePercent}%</b></li><li data-pass={enrollment.assignmentPassPercent >= 70}>งานผ่าน <b>{enrollment.assignmentPassPercent}%</b></li></ul><p>สถานะ: {enrollment.completionStatus}</p></section>
            <section><p className="eyebrow">MATERIALS</p><h2>เอกสารประกอบ</h2>{enrollment.materials.map((material) => <a className="material-link" href={`/api/materials/${material.id}`} key={material.id}><FileText /> {material.title}</a>)}</section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
