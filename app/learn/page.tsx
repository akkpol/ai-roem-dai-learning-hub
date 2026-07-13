import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarBlank, ChartBar, PlayCircle } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { getCurrentMember } from "@/lib/auth/session";
import { getLearnerEnrollments } from "@/lib/data/read-model";

export const metadata: Metadata = { title: "การเรียนของฉัน" };
export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in?next=/learn");
  const enrollments = await getLearnerEnrollments(member.userId, member.demo);

  return (
    <AppShell active="learn">
      <main className="portal-main dashboard-page">
        <div className="page-heading"><div><p className="eyebrow">MEMBER AREA</p><h1>การเรียนของฉัน</h1><p>คลาสที่ยืนยันแล้ว เอกสาร และความคืบหน้าจะอยู่ที่นี่</p></div></div>
        <div className="enrollment-grid">
          {enrollments.map((enrollment) => (
            <article className="enrollment-card" key={enrollment.id}>
              <span className="status-badge" data-status="confirmed">เปิดแน่นอน</span>
              <h2>{enrollment.courseTitle}</h2>
              <p>{enrollment.cohortTitle}</p>
              <div className="progress-heading"><span><ChartBar /> ความคืบหน้า</span><b>{enrollment.progressPercent}%</b></div>
              <div className="threshold-track"><span style={{ width: `${enrollment.progressPercent}%` }} /></div>
              <div className="enrollment-date"><CalendarBlank /> เริ่ม {enrollment.startsAt.toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" })}</div>
              <Link className="primary-cta link-cta" href={`/learn/${enrollment.id}`}><PlayCircle /> เปิดห้องเรียน</Link>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
