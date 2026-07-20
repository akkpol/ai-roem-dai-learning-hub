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

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>เข้าสู่ระบบ</h1>
        </CardTitle>
        <CardDescription>กลับเข้าสู่พื้นที่เรียนรู้ของคุณ</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm kind="sign-in" />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <LinkButton href="/forgot-password" variant="link">
          ลืมรหัสผ่าน
        </LinkButton>
        <LinkButton href="/sign-up" variant="outline" className="w-full">
          สร้างบัญชีใหม่
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
