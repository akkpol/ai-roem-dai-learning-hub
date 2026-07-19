import { MailCheckIcon } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader>
        <div className="bg-muted text-foreground flex size-10 items-center justify-center rounded-full">
          <MailCheckIcon className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>
          <h1>ยืนยันอีเมล</h1>
        </CardTitle>
        <CardDescription>
          เปิดลิงก์จากอีเมลเพื่อยืนยันบัญชี จากนั้นเข้าสู่ระบบได้ทันที
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-col gap-2">
        <LinkButton href="/sign-in" className="w-full">
          ไปหน้าเข้าสู่ระบบ
        </LinkButton>
        <LinkButton href="/sign-up" variant="link">
          ใช้อีเมลอื่นเพื่อสร้างบัญชี
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
