import { AuthForm } from "../_components/auth-form";
import { GoogleSignInForm } from "../_components/google-sign-in-form";

import { LinkButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasGoogleOAuthCredentials } from "@/modules/identity";

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>เข้าสู่ระบบ</h1>
        </CardTitle>
        <CardDescription>กลับเข้าสู่พื้นที่เรียนรู้ของคุณ</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <GoogleSignInForm
          enabled={hasGoogleOAuthCredentials(process.env)}
        />
        <AuthForm kind="sign-in" />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <LinkButton href="/forgot-password" variant="link">
          ลืมรหัสผ่าน
        </LinkButton>
        <LinkButton href="/account/privacy?mode=cancel-deletion" variant="link">
          ยกเลิกคำขอลบบัญชี
        </LinkButton>
        <LinkButton href="/sign-up" variant="outline" className="w-full">
          สร้างบัญชีใหม่
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
