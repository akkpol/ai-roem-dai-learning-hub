import { AuthForm } from "../_components/auth-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const value = (await searchParams).token;
  const token = typeof value === "string" && value.length <= 512 ? value : "";
  if (!token) {
    return (
      <section className="auth-card">
        <h1>ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง</h1>
        <p className="auth-help">กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง</p>
      </section>
    );
  }
  return (
    <section className="auth-card">
      <h1>ตั้งรหัสผ่านใหม่</h1>
      <p className="auth-help">ลิงก์ตั้งรหัสผ่านใช้ได้ครั้งเดียวภายใน 30 นาที</p>
      <AuthForm kind="reset-password" resetToken={token} />
    </section>
  );
}
