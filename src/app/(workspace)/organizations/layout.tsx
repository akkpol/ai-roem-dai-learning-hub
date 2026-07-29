import { Building2Icon, PlusIcon } from "lucide-react";

import { LinkButton } from "@/components/ui/button";

export default function OrganizationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav aria-label="พื้นที่องค์กร" className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <LinkButton href="/organizations" variant="ghost">
          <Building2Icon data-icon="inline-start" />
          องค์กรของฉัน
        </LinkButton>
        <LinkButton href="/organizations/new" size="lg" className="min-h-11">
          <PlusIcon data-icon="inline-start" />
          สร้างองค์กร
        </LinkButton>
      </nav>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
