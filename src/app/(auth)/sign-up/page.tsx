import { AuthForm } from "../_components/auth-form";
import { GooglePolicyDisclosure } from "../_components/google-policy-disclosure";
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
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { readGoogleOAuthDisclosure } from "@/modules/identity";

export default function SignUpPage() {
  const googleDisclosure = readGoogleOAuthDisclosure(process.env);
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
        <FieldGroup>
          {googleDisclosure && (
            <>
              <GoogleSignInForm enabled />
              <GooglePolicyDisclosure disclosure={googleDisclosure} />
              <FieldSeparator>หรือสร้างบัญชีด้วยอีเมล</FieldSeparator>
            </>
          )}
          <AuthForm
            kind="sign-up"
            termsVersion={process.env.AUTH_TERMS_VERSION}
            privacyVersion={process.env.AUTH_PRIVACY_VERSION}
          />
        </FieldGroup>
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
