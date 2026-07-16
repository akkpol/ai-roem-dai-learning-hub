import { AuthForm } from "../_components/auth-form";

export default function ForgotPasswordPage() {
  return <section className="auth-card"><h1>ลืมรหัสผ่าน</h1><p className="auth-help">ระบบจะแจ้งผลแบบเดียวกันไม่ว่าอีเมลจะมีในระบบหรือไม่</p><AuthForm kind="forgot-password" /></section>;
}
