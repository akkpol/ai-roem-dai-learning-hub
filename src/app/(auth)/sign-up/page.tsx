import { AuthForm } from "../_components/auth-form";

export default function SignUpPage() {
  return (
    <section className="auth-card">
      <p className="eyebrow">LEARNING HUB</p>
      <h1>สร้างบัญชี</h1>
      <p className="auth-help">เริ่มเรียนรู้ทุกศาสตร์ด้วยบัญชีเดียว</p>
      <AuthForm
        kind="sign-up"
        termsVersion={process.env.AUTH_TERMS_VERSION ?? "current"}
        privacyVersion={process.env.AUTH_PRIVACY_VERSION ?? "current"}
      />
    </section>
  );
}
