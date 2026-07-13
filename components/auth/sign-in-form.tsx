"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";

export function SignInForm({ configured, nextPath }: { configured: boolean; nextPath: string }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setPending(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(false);
    if (error) {
      setMessage(error.message || "ส่งรหัสไม่สำเร็จ กรุณาลองใหม่");
      return;
    }
    setStep("otp");
    setMessage("ส่งรหัส 6 หลักไปยังอีเมลแล้ว");
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (error) {
      setMessage(error.message || "รหัสไม่ถูกต้องหรือหมดอายุแล้ว");
      return;
    }
    window.location.assign(nextPath);
  }

  async function signInWithGoogle() {
    setPending(true);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: nextPath });
    if (error) {
      setPending(false);
      setMessage(error.message || "เชื่อม Google ไม่สำเร็จ");
    }
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">CLOSED BETA</p>
      <h1>เข้าสู่ระบบ AI เริ่มได้</h1>
      <p>ใช้อีเมลที่ได้รับคำเชิญ ระบบจะตรวจสิทธิ์ของคุณก่อนให้จองรุ่นเรียน</p>
      {!configured && (
        <div className="setup-notice" role="status">
          Local demo mode เปิดอยู่ หน้านี้จะแสดง flow จริงเมื่อเพิ่ม Neon Auth environment variables
        </div>
      )}
      {step === "email" ? (
        <form onSubmit={requestOtp} className="stack-form">
          <label htmlFor="email">อีเมลที่ได้รับคำเชิญ</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@gmail.com"
            required
          />
          <button type="submit" disabled={pending || !configured}>
            {pending ? "กำลังส่ง…" : "ส่งรหัส OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="stack-form">
          <label htmlFor="otp">รหัส OTP 6 หลัก</label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
          <button type="submit" disabled={pending || otp.length !== 6}>
            {pending ? "กำลังตรวจสอบ…" : "ยืนยันและเข้าสู่ระบบ"}
          </button>
          <button className="text-button" type="button" onClick={() => setStep("email")}>
            เปลี่ยนอีเมล
          </button>
        </form>
      )}
      <div className="auth-separator"><span>หรือ</span></div>
      <button
        className="google-button"
        type="button"
        onClick={signInWithGoogle}
        disabled={pending || !configured}
      >
        เข้าสู่ระบบด้วย Google
      </button>
      {message && <p className="form-message" aria-live="polite">{message}</p>}
      <small>การเข้าสู่ระบบไม่ได้ทำให้เกิดค่าใช้จ่าย และยังไม่ถือว่าคลาสเปิดแน่นอน</small>
    </div>
  );
}
