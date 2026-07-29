import { OrganizationCreateForm } from "../_components/organization-forms";

export default function NewOrganizationPage() {
  return (
    <section aria-labelledby="new-organization-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="new-organization-heading" className="font-heading text-2xl font-semibold">สร้างองค์กร</h1>
        <p className="text-muted-foreground">เริ่มพื้นที่ทำงานสำหรับสถาบันหรือทีมของคุณ</p>
      </div>
      <OrganizationCreateForm />
    </section>
  );
}
