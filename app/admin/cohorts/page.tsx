import { CohortBoard } from "@/components/admin/cohort-board";
import { AdminOperationsPanel } from "@/components/admin/operations-panel";
import { getCurrentMember } from "@/lib/auth/session";
import { getAdminCohorts, getAdminOperationsData } from "@/lib/data/read-model";

export default async function AdminCohortsPage() {
  const [cohorts, member, operations] = await Promise.all([getAdminCohorts(), getCurrentMember(), getAdminOperationsData()]);
  const demo = Boolean(member?.demo);
  return <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">COHORT CONTROL</p><h1>รุ่นเรียนและจำนวนขั้นต่ำ</h1><p>ถึงเกณฑ์แล้วระบบยังไม่เปิดเอง — admin ต้องยืนยันทุกครั้ง</p></div></div><CohortBoard cohorts={cohorts} demo={demo} /><AdminOperationsPanel data={operations} demo={demo} /></main>;
}
