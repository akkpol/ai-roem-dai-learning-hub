"use client";

import { useState, type FormEvent } from "react";

type Kind = "sign-up" | "sign-in" | "forgot-password" | "reset-password";

const endpoints: Record<Kind, string> = {
  "sign-up": "/api/auth/sign-up",
  "sign-in": "/api/auth/sign-in",
  "forgot-password": "/api/auth/forgot-password",
  "reset-password": "/api/auth/reset-password",
};

export function AuthForm({
  kind,
  termsVersion,
  privacyVersion,
}: {
  kind: Kind;
  termsVersion?: string;
  privacyVersion?: string;
}) {
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    const values: Record<string, string | boolean> = {};
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") values[key] = value;
    }
    if (kind === "sign-up") values.ageAttested = values.ageAttested === "on";
    const response = await fetch(endpoints[kind], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    setStatus(typeof result.message === "string" ? result.message : "กรุณาลองใหม่");
    setSubmitting(false);
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {(kind === "sign-up") && (
        <label>
          ชื่อที่แสดง
          <input name="displayName" autoComplete="name" required maxLength={120} />
        </label>
      )}
      {kind !== "reset-password" && (
        <label>
          อีเมล
          <input name="email" type="email" autoComplete="email" required />
        </label>
      )}
      {(kind === "sign-up" || kind === "sign-in" || kind === "reset-password") && (
        <label>
          {kind === "reset-password" ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
          <input
            name={kind === "reset-password" ? "newPassword" : "password"}
            type="password"
            autoComplete={kind === "sign-in" ? "current-password" : "new-password"}
            minLength={12}
            maxLength={128}
            required
          />
        </label>
      )}
      {kind === "sign-up" && (
        <>
          <label className="check-row">
            <input name="ageAttested" type="checkbox" required />
            ฉันยืนยันว่ามีอายุ 18 ปีขึ้นไป
          </label>
          <p className="policy-copy">ฉันยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว</p>
          <input name="termsVersion" type="hidden" value={termsVersion} />
          <input name="privacyVersion" type="hidden" value={privacyVersion} />
          <input name="callbackPath" type="hidden" value="/verify-email" />
        </>
      )}
      {kind === "sign-in" && <input name="callbackPath" type="hidden" value="/" />}
      {kind === "forgot-password" && (
        <input name="redirectPath" type="hidden" value="/reset-password" />
      )}
      {kind === "reset-password" && (
        <label>
          รหัสยืนยัน
          <input name="token" autoComplete="one-time-code" required />
        </label>
      )}
      <button disabled={submitting} type="submit">
        {submitting ? "กำลังดำเนินการ…" : "ดำเนินการต่อ"}
      </button>
      <p aria-live="polite" className="form-status">{status}</p>
    </form>
  );
}
