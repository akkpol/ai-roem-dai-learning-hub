import Link from "next/link"

import { AuthForm } from "@/app/(auth)/_components/auth-form"
import { GoogleSignInForm } from "@/app/(auth)/_components/google-sign-in-form"
import {
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"

export function LoginForm({
  className,
  googleEnabled,
  ...props
}: React.ComponentProps<"div"> & { googleEnabled: boolean }) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
          <p className="text-sm text-balance text-muted-foreground">
            กลับเข้าสู่พื้นที่เรียนรู้ของคุณ
          </p>
        </div>

        <AuthForm kind="sign-in" />

        {googleEnabled && (
          <>
            <FieldSeparator>หรือเข้าสู่ระบบด้วย</FieldSeparator>
            <GoogleSignInForm enabled />
          </>
        )}

        <FieldDescription className="text-center">
          ยังไม่มีบัญชี? <Link href="/sign-up">สร้างบัญชีใหม่</Link>
        </FieldDescription>
        <FieldDescription className="text-center">
          ต้องการกลับมาใช้บัญชีที่ขอลบ?{" "}
          <Link href="/account/privacy?mode=cancel-deletion">
            ยกเลิกคำขอลบบัญชี
          </Link>
        </FieldDescription>
      </FieldGroup>
    </div>
  )
}
