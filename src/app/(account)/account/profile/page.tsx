import { ProfileForm } from "../_components/account-forms";

export default function ProfilePage() {
  return <section aria-labelledby="profile-heading" className="flex flex-col gap-4"><div><h1 id="profile-heading" className="font-heading text-2xl font-semibold">ตั้งค่าโปรไฟล์</h1><p className="text-muted-foreground">ข้อมูลส่วนตัวขั้นต่ำสำหรับพื้นที่เรียนรู้</p></div><ProfileForm /></section>;
}
