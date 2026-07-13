import { InviteForm } from "@/components/admin/invite-form";
import { getCurrentMember } from "@/lib/auth/session";
import { getAdminCohorts, getInviteSummary } from "@/lib/data/read-model";

export default async function InvitationsPage() {
  const [rows, cohorts, member] = await Promise.all([getInviteSummary(), getAdminCohorts(), getCurrentMember()]);
  return (
    <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">INVITE ONLY</p><h1>คำเชิญสมาชิก</h1><p>เชิญเป็นรายอีเมลและจำกัดไม่เกิน 50 คนต่อรุ่น</p></div></div><InviteForm cohorts={cohorts} demo={Boolean(member?.demo)} /><div className="admin-table"><div className="table-row table-head"><span>รุ่นเรียน</span><span>เชิญ</span><span>ยอมรับ</span><span>จองแล้ว</span><span>Conversion</span></div>{rows.map((row) => <div className="table-row" key={row.cohortTitle}><strong>{row.cohortTitle}</strong><span>{Number(row.invited)}</span><span>{Number(row.accepted)}</span><span>{Number(row.reserved)}</span><span>{Number(row.accepted) ? Math.round((Number(row.reserved) / Number(row.accepted)) * 100) : 0}%</span></div>)}</div><div className="setup-notice">ก่อนส่งจริง ระบบจะตรวจอีเมลซ้ำ, จำนวนรวมต่อรุ่น และสร้าง notification outbox ด้วย dedupe key</div></main>
  );
}
