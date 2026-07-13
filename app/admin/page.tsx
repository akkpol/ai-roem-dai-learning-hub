import Link from "next/link";
import { getAdminCohorts, getBetaScorecard, getInviteSummary } from "@/lib/data/read-model";

export default async function AdminPage() {
  const [cohorts, scorecard, invites] = await Promise.all([getAdminCohorts(), getBetaScorecard(), getInviteSummary()]);
  return (
    <main className="admin-main">
      <div className="page-heading"><div><p className="eyebrow">OPERATIONS</p><h1>Closed Beta overview</h1><p>ตัดสินใจเปิดคลาสจากจำนวนจริง ตารางผู้สอน และความเสี่ยง</p></div></div>
      <div className="admin-summary-grid"><article><span>รุ่นที่เปิดรับ</span><strong>{cohorts.filter((cohort) => cohort.status === "collecting").length}</strong><Link href="/admin/cohorts">จัดการรุ่น →</Link></article><article><span>รอยืนยัน</span><strong>{cohorts.filter((cohort) => cohort.status === "threshold_met").length}</strong><Link href="/admin/cohorts">ตรวจสอบ →</Link></article><article><span>Invitations</span><strong>{invites.reduce((total, item) => total + Number(item.invited), 0)}</strong><Link href="/admin/invitations">ดูคำเชิญ →</Link></article><article><span>Threshold rate</span><strong>{scorecard.thresholdAttainmentRate ?? "—"}%</strong><Link href="/admin/analytics">ดู KPI →</Link></article></div>
      <section className="admin-attention"><p className="eyebrow">NEEDS ATTENTION</p><h2>สิ่งที่ทีมต้องตัดสินใจ</h2>{cohorts.filter((cohort) => cohort.status === "threshold_met" || cohort.status === "postponed").map((cohort) => <article key={cohort.id}><div><b>{cohort.title}</b><span>{cohort.status === "threshold_met" ? "ถึงเกณฑ์แล้ว รอตรวจผู้สอนและต้นทุน" : "ไม่ถึงเกณฑ์ ต้องกำหนด fallback date"}</span></div><Link href="/admin/cohorts">เปิดรายการ</Link></article>)}</section>
    </main>
  );
}
