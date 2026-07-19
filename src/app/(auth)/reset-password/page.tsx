import { AuthForm } from "../_components/auth-form";

import { LinkButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const value = (await searchParams).token;
  const token = typeof value === "string" && value.length <= 512 ? value : "";

  if (!token) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                <h1>ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง</h1>
              </EmptyTitle>
              <EmptyDescription>
                กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <LinkButton href="/forgot-password">ขอลิงก์ใหม่</LinkButton>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>ตั้งรหัสผ่านใหม่</h1>
        </CardTitle>
        <CardDescription>
          ลิงก์ตั้งรหัสผ่านใช้ได้ครั้งเดียวภายใน 30 นาที
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm kind="reset-password" resetToken={token} />
      </CardContent>
      <CardFooter>
        <LinkButton href="/forgot-password" variant="outline" className="w-full">
          ขอลิงก์ใหม่
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
