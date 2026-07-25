import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GoogleSignInErrorPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>เข้าสู่ระบบด้วย Google ไม่สำเร็จ</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertTitle>ยังเข้าสู่ระบบไม่ได้</AlertTitle>
          <AlertDescription>
            กรุณากลับไปลองอีกครั้ง หรือเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <LinkButton href="/login" className="w-full">
          กลับไปหน้าเข้าสู่ระบบ
        </LinkButton>
      </CardFooter>
    </Card>
  );
}
