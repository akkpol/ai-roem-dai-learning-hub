import { LinkButton } from "@/components/ui/button";

export default function IdentityAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <nav
          aria-label="เครื่องมือผู้ดูแล Identity"
          className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-4 sm:px-6"
        >
          <LinkButton href="/" variant="ghost">
            Learning Hub
          </LinkButton>
          <LinkButton href="/admin/identity/accounts" variant="secondary">
            บัญชีและสิทธิ์
          </LinkButton>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
