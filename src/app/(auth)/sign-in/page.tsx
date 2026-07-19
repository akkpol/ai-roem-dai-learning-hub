import { AuthForm } from "../_components/auth-form";

export default function SignInPage() {
  return <section className="auth-card"><h1>เข้าสู่ระบบ</h1><p className="auth-help">กลับเข้าสู่พื้นที่เรียนรู้ของคุณ</p><AuthForm kind="sign-in" /></section>;
}
