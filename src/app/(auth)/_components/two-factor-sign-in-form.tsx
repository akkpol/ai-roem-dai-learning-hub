"use client";

import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function TwoFactorSignInForm() {
  const [status, setStatus] = useState<{ error: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch("/api/auth/two-factor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setStatus({ error: true, message: "รหัสไม่ถูกต้อง หมดอายุ หรือเคยใช้แล้ว" });
        return;
      }
      setStatus({ error: false, message: "ยืนยันสำเร็จ กำลังกลับสู่หน้าหลัก" });
      window.location.assign("/");
    } catch {
      setStatus({ error: true, message: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy}>
      <FieldGroup>
        <Field><FieldLabel htmlFor="totpCode">รหัส TOTP</FieldLabel><Input id="totpCode" name="totpCode" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" /><FieldDescription>กรอกรหัส 6 หลักจากแอปยืนยันตัวตน</FieldDescription></Field>
        <Field><FieldLabel htmlFor="recoveryCode">หรือรหัสกู้คืน</FieldLabel><Input id="recoveryCode" name="recoveryCode" autoComplete="one-time-code" /><FieldDescription>รหัสกู้คืนแต่ละรหัสใช้ได้เพียงครั้งเดียว</FieldDescription></Field>
        <Button type="submit" isDisabled={busy}>{busy && <Spinner data-icon="inline-start" />}{busy ? "กำลังยืนยัน…" : "ยืนยันตัวตน"}</Button>
        {status && <Alert variant={status.error ? "destructive" : "default"}><AlertTitle>{status.error ? "ยืนยันไม่สำเร็จ" : "ยืนยันแล้ว"}</AlertTitle><AlertDescription>{status.message}</AlertDescription></Alert>}
      </FieldGroup>
    </form>
  );
}
