import { LinkButton } from "@/components/ui/button";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav aria-label="ตั้งค่าบัญชี" className="mx-auto flex w-full max-w-5xl flex-wrap gap-2 px-4 py-4 sm:px-6">
        <LinkButton href="/account/profile" variant="ghost">โปรไฟล์</LinkButton>
        <LinkButton href="/account/security" variant="ghost">ความปลอดภัย</LinkButton>
        <LinkButton href="/account/privacy" variant="ghost">ความเป็นส่วนตัว</LinkButton>
      </nav>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
