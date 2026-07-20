import { PrivacyForms } from "../_components/account-forms";

export default function PrivacyPage() {
  return <section aria-labelledby="privacy-heading" className="flex flex-col gap-4"><div><h1 id="privacy-heading" className="font-heading text-2xl font-semibold">ความเป็นส่วนตัว</h1><p className="text-muted-foreground">ตรวจสอบนโยบาย ดาวน์โหลดข้อมูล และควบคุมวงจรชีวิตบัญชี</p></div><PrivacyForms /></section>;
}
