import { IdentityAccountSearch } from "../_components/identity-account-search";

export default function IdentityAccountsPage() {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="identity-title">
      <div className="flex max-w-3xl flex-col gap-2">
        <p className="text-sm text-muted-foreground">Identity operations</p>
        <h1 id="identity-title" className="font-heading text-2xl font-medium">
          ค้นหาบัญชีแบบเจาะจง
        </h1>
        <p className="text-muted-foreground">
          ใช้ UUID ของบัญชีหรืออีเมลตัวพิมพ์เล็กที่ตรงทั้งหมดเท่านั้น
          ระบบไม่รองรับการค้นหาบางส่วนหรือการส่งออกเป็นกลุ่ม
        </p>
      </div>
      <IdentityAccountSearch />
    </section>
  );
}
