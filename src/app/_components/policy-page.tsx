import Link from "next/link";
import type { ReactNode } from "react";

import { currentIdentityPolicies } from "@/modules/identity";

export function PolicyPage({
  title,
  version,
  summary,
  children,
}: {
  title: string;
  version: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <article className="typeset-policy mx-auto rounded-xl border bg-card px-5 py-8 text-card-foreground shadow-sm sm:px-10 sm:py-12">
        <header>
          <Link
            href="/"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Learning Hub
          </Link>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            เวอร์ชัน {version} · มีผลวันที่{" "}
            {currentIdentityPolicies.effectiveDate}
          </p>
          <p className="text-muted-foreground">{summary}</p>
        </header>

        {children}

        <footer className="border-t pt-6 text-sm text-muted-foreground">
          <p>
            กลับไปที่ <Link href="/">หน้าแรก</Link> หรือ{" "}
            <Link href="/login">เข้าสู่ระบบ</Link>
          </p>
        </footer>
      </article>
    </main>
  );
}
