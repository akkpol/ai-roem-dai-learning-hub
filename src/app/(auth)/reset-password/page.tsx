import { AuthForm } from "../_components/auth-form";

export default function ResetPasswordPage() {
  return <section className="auth-card"><h1>ตั้งรหัสผ่านใหม่</h1><p className="auth-help">ลิงก์ตั้งรหัสผ่านใช้ได้ครั้งเดียวภายใน 30 นาที</p><AuthForm kind="reset-password" /></section>;
}
