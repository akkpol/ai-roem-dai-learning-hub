import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentMember } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in?next=/admin");
  if (member.role !== "admin") redirect("/learn");
  return (
    <AppShell active="admin">
      <div className="admin-shell">
        <aside className="admin-sidebar"><p>ADMIN</p><nav><Link href="/admin">ภาพรวม</Link><Link href="/admin/cohorts">รุ่นเรียน</Link><Link href="/admin/invitations">คำเชิญ</Link><Link href="/admin/certificates">ใบประกาศ</Link><Link href="/admin/analytics">Analytics</Link></nav><small>Closed Beta · ไม่รับชำระเงิน</small></aside>
        {children}
      </div>
    </AppShell>
  );
}
