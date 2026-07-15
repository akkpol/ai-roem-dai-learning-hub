import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasRole } from "@/lib/auth/roles";
import { getCurrentMember } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in?next=/admin");
  if (!hasRole(member.roles, "admin")) redirect("/learn");
  return (
    <AppShell active="admin">
      <div className="admin-shell">
        <aside className="admin-sidebar"><p>ADMIN</p><nav><Link href="/admin">คิวตัดสินใจ</Link><Link href="/admin/reviews">ตรวจคอร์ส</Link><Link href="/admin/cohorts">รุ่นเรียน</Link><Link href="/admin/access">สิทธิ์ผู้ใช้</Link><Link href="/admin/payments">การชำระเงิน</Link><Link href="/admin/certificates">ใบประกาศ</Link><Link href="/admin/analytics">Analytics</Link></nav><small>Learning Studio · Thai-first</small></aside>
        {children}
      </div>
    </AppShell>
  );
}
