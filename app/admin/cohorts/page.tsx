import { CohortBoard } from "@/components/admin/cohort-board";
import { getCurrentMember } from "@/lib/auth/session";
import { getAdminCohorts } from "@/lib/data/read-model";

export default async function AdminCohortsPage() {
  const [cohorts, member] = await Promise.all([getAdminCohorts(), getCurrentMember()]);
  return <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">COHORT CONTROL</p><h1>รุ่นเรียนและจำนวนขั้นต่ำ</h1><p>ถึงเกณฑ์แล้วระบบยังไม่เปิดเอง — admin ต้องยืนยันทุกครั้ง</p></div><button type="button">+ สร้างรุ่นเรียน</button></div><CohortBoard cohorts={cohorts} demo={Boolean(member?.demo)} /></main>;
}
