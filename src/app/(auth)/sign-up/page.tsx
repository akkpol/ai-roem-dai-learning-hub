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

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>LEARNING HUB</CardDescription>
        <CardTitle>
          <h1>สร้างบัญชี</h1>
        </CardTitle>
        <CardDescription>เริ่มเรียนรู้ทุกศาสตร์ด้วยบัญชีเดียว</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm
          kind="sign-up"
          termsVersion={process.env.AUTH_TERMS_VERSION ?? "current"}
          privacyVersion={process.env.AUTH_PRIVACY_VERSION ?? "current"}
        />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <CardDescription>มีบัญชีอยู่แล้ว?</CardDescription>
        <LinkButton href="/login" variant="outline" className="w-full">
          เข้าสู่ระบบ
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
