import { GraduationCapIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";

export default function HomePage() {
  return (
    <main
      aria-labelledby="public-status-title"
      className="flex min-h-svh items-center justify-center px-4 py-10 sm:px-6"
    >
      <Empty className="max-w-2xl border bg-card px-5 py-12 sm:px-10 sm:py-16">
        <EmptyHeader className="max-w-xl gap-4">
          <EmptyMedia variant="icon" aria-hidden="true">
            <GraduationCapIcon />
          </EmptyMedia>
          <Badge variant="secondary">กำลังพัฒนา</Badge>
          <h1
            id="public-status-title"
            className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            พื้นที่เรียนรู้สำหรับทุกศาสตร์
          </h1>
          <EmptyDescription>
            แพลตฟอร์มกำลังถูกสร้างใหม่บนโครงสร้างที่พร้อมสำหรับผู้เรียน ผู้สอน
            และสถาบัน
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <LinkButton className="w-full sm:w-auto" href="/sign-up" size="lg">
              สมัครสมาชิก
            </LinkButton>
            <LinkButton
              className="w-full sm:w-auto"
              href="/login"
              size="lg"
              variant="outline"
            >
              เข้าสู่ระบบ
            </LinkButton>
          </div>
        </EmptyContent>
      </Empty>
    </main>
  );
}
