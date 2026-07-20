import { DeletionCancellationForm, PrivacyForms } from "../_components/account-forms";

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const cancellationOnly = (await searchParams).mode === "cancel-deletion";
  return <section aria-labelledby="privacy-heading" className="flex flex-col gap-4"><div><h1 id="privacy-heading" className="font-heading text-2xl font-semibold">ความเป็นส่วนตัว</h1><p className="text-muted-foreground">{cancellationOnly ? "ยืนยันข้อมูลเพื่อยกเลิกคำขอลบบัญชี" : "ตรวจสอบนโยบาย ดาวน์โหลดข้อมูล และควบคุมวงจรชีวิตบัญชี"}</p></div>{cancellationOnly ? <DeletionCancellationForm /> : <PrivacyForms />}</section>;
}
