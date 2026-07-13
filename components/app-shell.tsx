import Link from "next/link";
import { BookOpenText, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { getCurrentMember } from "@/lib/auth/session";

export async function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "courses" | "learn" | "certificates" | "admin";
}) {
  const member = await getCurrentMember();

  return (
    <div className="portal-shell">
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
          <Link href="/" data-active={active === "courses"}>คอร์ส</Link>
          <Link href="/learn" data-active={active === "learn"}>การเรียนของฉัน</Link>
          <Link href="/account/certificates" data-active={active === "certificates"}>ใบประกาศ</Link>
          {member?.role === "admin" && (
            <Link href="/admin" data-active={active === "admin"}>Admin</Link>
          )}
        </nav>
        {member ? (
          <div className="member-pill">
            <span aria-hidden="true">{member.displayName.slice(0, 1)}</span>
            <div>
              <strong>{member.displayName}</strong>
              <small>{member.demo ? "Demo mode" : member.email}</small>
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
