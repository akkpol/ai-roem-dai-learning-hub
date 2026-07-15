import { AccessManager } from "@/components/admin/access-manager";
import { getCurrentMember } from "@/lib/auth/session";
import { getAccessManagementData } from "@/lib/data/admin-studio-read-model";

export default async function AdminAccessPage() {
  const member = await getCurrentMember();
  const data = await getAccessManagementData(Boolean(member?.demo));
  return <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">ACCESS & ASSIGNMENTS</p><h1>สิทธิ์และการมอบหมาย</h1><p>บัญชีเดียวมีหลายบทบาท แต่ทุกคอร์สและรุ่นเรียนยังต้องได้รับมอบหมายโดยตรง</p></div></div><AccessManager data={data} demo={Boolean(member?.demo)} /></main>;
}
