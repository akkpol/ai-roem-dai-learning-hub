import { SecurityForms } from "../_components/account-forms";

export default function SecurityPage() {
  return <section aria-labelledby="security-heading" className="flex flex-col gap-4"><div><h1 id="security-heading" className="font-heading text-2xl font-semibold">ความปลอดภัยของบัญชี</h1><p className="text-muted-foreground">จัดการรหัสผ่าน อุปกรณ์ และการยืนยันสองขั้นตอน</p></div><SecurityForms /></section>;
}
