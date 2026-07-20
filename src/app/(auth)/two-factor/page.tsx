import { TwoFactorSignInForm } from "../_components/two-factor-sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TwoFactorPage() {
  return <Card><CardHeader><CardTitle><h1>ยืนยันตัวตนสองขั้นตอน</h1></CardTitle><CardDescription>ใช้รหัส 6 หลักจากแอป หรือรหัสกู้คืนที่ยังไม่เคยใช้</CardDescription></CardHeader><CardContent><TwoFactorSignInForm /></CardContent></Card>;
}
