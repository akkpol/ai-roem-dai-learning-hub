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

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>ลืมรหัสผ่าน</h1>
        </CardTitle>
        <CardDescription>
          ระบบจะแจ้งผลแบบเดียวกันไม่ว่าอีเมลจะมีในระบบหรือไม่
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm kind="forgot-password" />
      </CardContent>
      <CardFooter>
        <LinkButton href="/sign-in" variant="outline" className="w-full">
          กลับไปเข้าสู่ระบบ
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
