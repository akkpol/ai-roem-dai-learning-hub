import { OrganizationSettingsForm } from "../../_components/organization-forms";

export default async function OrganizationSettingsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  return (
    <section aria-labelledby="organization-settings-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="organization-settings-heading" className="font-heading text-2xl font-semibold">ตั้งค่าองค์กร</h1>
        <p className="text-muted-foreground">แก้ไขข้อมูลที่แสดงขององค์กร ชื่อ URL จะคงเดิมหลังสร้าง</p>
      </div>
      <OrganizationSettingsForm organizationId={(await params).organizationId} />
    </section>
  );
}
