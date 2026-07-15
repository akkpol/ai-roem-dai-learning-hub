import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Bell,
  BookOpenText,
  Books,
  CaretDown,
  ChartBar,
  Desktop,
  FileText,
  House,
  ShieldCheck,
  Sparkle,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { switchWorkspace } from "@/app/actions/workspace";
import { type MemberRole } from "@/lib/auth/roles";
import { getCurrentMember } from "@/lib/auth/session";

type ActiveArea = "courses" | "learn" | "certificates" | "teach" | "admin";

const workspaceLabels: Record<MemberRole, string> = {
  student: "พื้นที่ผู้เรียน",
  instructor: "พื้นที่ผู้สอน",
  admin: "ระบบแอดมิน",
};

function WorkspaceIcon({ role }: { role: MemberRole }) {
  if (role === "instructor") return <Desktop aria-hidden="true" />;
  if (role === "admin") return <ShieldCheck aria-hidden="true" />;
  return <UserCircle aria-hidden="true" />;
}

function activeWorkspace(active?: ActiveArea): MemberRole {
  if (active === "teach") return "instructor";
  if (active === "admin") return "admin";
  return "student";
}

export async function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: ActiveArea;
}) {
  const member = await getCurrentMember();
  const workspace = activeWorkspace(active);

  return (
    <div className="portal-shell" data-workspace={workspace}>
      <header className="portal-header">
        <Link className="brand" href="/" aria-label="AI เริ่มได้ หน้าหลัก">
          <span className="brand-mark" aria-hidden="true">
            <BookOpenText weight="duotone" />
            <Sparkle weight="fill" />
          </span>
          <span>
            <strong>AI เริ่มได้</strong>
            <small>เรียน AI ให้ใช้ได้จริง</small>
          </span>
        </Link>

        <nav className="portal-nav" aria-label="เมนูหลัก">
          {workspace === "instructor" ? (
            <>
              <Link href="/teach" data-active={active === "teach"}><House aria-hidden="true" />หน้าหลัก</Link>
              <Link href="/teach#courses"><Books aria-hidden="true" />จัดการคอร์ส</Link>
              <Link href="/teach#learners"><UsersThree aria-hidden="true" />ผู้เรียน</Link>
              <Link href="/teach#resources"><FileText aria-hidden="true" />สื่อการสอน</Link>
              <Link href="/teach#reports"><ChartBar aria-hidden="true" />รายงาน</Link>
            </>
          ) : workspace === "admin" ? (
            <>
              <Link href="/admin" data-active={active === "admin"}>ภาพรวม</Link>
              <Link href="/admin/reviews">ตรวจคอร์ส</Link>
              <Link href="/admin/access">สิทธิ์ผู้ใช้</Link>
              <Link href="/admin/payments">การชำระเงิน</Link>
            </>
          ) : (
            <>
              <Link href="/" data-active={active === "courses"}>คอร์ส</Link>
              <Link href="/learn" data-active={active === "learn"}>การเรียนของฉัน</Link>
              <Link href="/account/certificates" data-active={active === "certificates"}>ใบประกาศ</Link>
            </>
          )}
        </nav>

        {member ? (
          <div className="member-actions">
            <details className="workspace-switcher">
              <summary aria-label={`พื้นที่ปัจจุบัน ${workspaceLabels[workspace]}`}>
                <WorkspaceIcon role={workspace} />
                <span>{workspaceLabels[workspace]}</span>
                <CaretDown aria-hidden="true" />
              </summary>
              <div className="workspace-menu" role="menu" aria-label="สลับพื้นที่ทำงาน">
                {member.roles.map((role) => {
                  const action = switchWorkspace.bind(null, role);
                  return (
                    <form action={action} key={role} role="none">
                      <button type="submit" role="menuitem" data-current={role === workspace}>
                        <WorkspaceIcon role={role} />
                        <span>{workspaceLabels[role]}</span>
                        {role === workspace && <Check aria-label="พื้นที่ปัจจุบัน" weight="bold" />}
                      </button>
                    </form>
                  );
                })}
              </div>
            </details>
            <button className="notification-button" type="button" aria-label="การแจ้งเตือน">
              <Bell aria-hidden="true" />
            </button>
            <div className="member-pill">
              {member.avatarUrl ? (
                <Image src={member.avatarUrl} alt="" width={44} height={44} />
              ) : (
                <span aria-hidden="true">{member.displayName.slice(0, 1)}</span>
              )}
              <div>
                <strong>{member.displayName}</strong>
                <small>{member.demo ? "Demo mode" : member.email}</small>
              </div>
              {workspace === "instructor" && <CaretDown className="member-caret" aria-hidden="true" />}
            </div>
          </div>
        ) : (
          <Link className="portal-sign-in" href="/auth/sign-in">เข้าสู่ระบบ</Link>
        )}
      </header>
      {children}
    </div>
  );
}
