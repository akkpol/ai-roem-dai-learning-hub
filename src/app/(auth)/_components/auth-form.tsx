"use client";

import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Kind = "sign-up" | "sign-in" | "forgot-password" | "reset-password";
type FormStatus = { tone: "success" | "error"; message: string } | null;
type ValidatedField = "displayName" | "email" | "password" | "ageAttested";

const endpoints: Record<Kind, string> = {
  "sign-up": "/api/auth/sign-up",
  "sign-in": "/api/auth/sign-in",
  "forgot-password": "/api/auth/forgot-password",
  "reset-password": "/api/auth/reset-password",
};

const actionLabels: Record<Kind, { idle: string; pending: string }> = {
  "sign-up": { idle: "สร้างบัญชี", pending: "กำลังสร้างบัญชี…" },
  "sign-in": { idle: "เข้าสู่ระบบ", pending: "กำลังเข้าสู่ระบบ…" },
  "forgot-password": {
    idle: "ส่งลิงก์ตั้งรหัสผ่านใหม่",
    pending: "กำลังส่งคำขอ…",
  },
  "reset-password": {
    idle: "ตั้งรหัสผ่านใหม่",
    pending: "กำลังตั้งรหัสผ่านใหม่…",
  },
};

const fallbackSuccessMessage = "ระบบรับคำขอของคุณแล้ว";
const fallbackErrorMessage = "ยังดำเนินการไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง";

function readMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("message" in value)) return;
  const message = value.message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

export function AuthForm({
  kind,
  termsVersion,
  privacyVersion,
  resetToken,
}: {
  kind: Kind;
  termsVersion?: string;
  privacyVersion?: string;
  resetToken?: string;
}) {
  const [status, setStatus] = useState<FormStatus>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ValidatedField, string>>
  >({});

  function fieldName(input: HTMLInputElement): ValidatedField | undefined {
    if (input.name === "newPassword") return "password";
    if (
      input.name === "displayName" ||
      input.name === "email" ||
      input.name === "password" ||
      input.name === "ageAttested"
    ) {
      return input.name;
    }
  }

  function markInvalid(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const name = fieldName(target);
    if (!name) return;

    const message =
      name === "ageAttested"
        ? "กรุณายืนยันว่าคุณมีอายุ 18 ปีขึ้นไป"
        : name === "email" && target.validity.typeMismatch
        ? "กรุณากรอกอีเมลให้ถูกต้อง"
        : name === "password" && target.validity.tooShort
          ? "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร"
          : "กรุณากรอกข้อมูลในช่องนี้";

    setFieldErrors((current) => ({ ...current, [name]: message }));
  }

  function clearInvalid(event: FormEvent<HTMLInputElement>) {
    const name = fieldName(event.currentTarget);
    if (!name || !fieldErrors[name]) return;

    setFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    const values: Record<string, string | boolean> = {};
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") values[key] = value;
    }
    if (kind === "sign-up") values.ageAttested = values.ageAttested === "on";

    try {
      const response = await fetch(endpoints[kind], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        setStatus({
          tone: "error",
          message: "ระบบตอบกลับไม่สมบูรณ์ กรุณาลองอีกครั้ง",
        });
        return;
      }

      setStatus(
        response.ok
          ? {
              tone: "success",
              message: readMessage(result) ?? fallbackSuccessMessage,
            }
          : { tone: "error", message: fallbackErrorMessage },
      );
    } catch {
      setStatus({
        tone: "error",
        message: "เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบเครือข่ายแล้วลองอีกครั้ง",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form aria-busy={submitting} onInvalid={markInvalid} onSubmit={submit}>
      <FieldGroup>
        {kind === "sign-up" && (
          <Field data-invalid={Boolean(fieldErrors.displayName)}>
            <FieldLabel htmlFor="displayName">ชื่อที่แสดง</FieldLabel>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              required
              maxLength={120}
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={[
                "displayName-description",
                fieldErrors.displayName ? "displayName-error" : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
              onInput={clearInvalid}
            />
            <FieldDescription id="displayName-description">
              ชื่อนี้จะแสดงในพื้นที่เรียนรู้ของคุณ
            </FieldDescription>
            <FieldError id="displayName-error">
              {fieldErrors.displayName}
            </FieldError>
          </Field>
        )}

        {kind !== "reset-password" && (
          <Field data-invalid={Boolean(fieldErrors.email)}>
            <FieldLabel htmlFor="email">อีเมล</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={[
                kind === "forgot-password" ? "email-description" : undefined,
                fieldErrors.email ? "email-error" : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
              onInput={clearInvalid}
            />
            {kind === "forgot-password" && (
              <FieldDescription id="email-description">
                เพื่อความเป็นส่วนตัว ระบบจะแจ้งผลแบบเดียวกันทุกอีเมล
              </FieldDescription>
            )}
            <FieldError id="email-error">{fieldErrors.email}</FieldError>
          </Field>
        )}

        {(kind === "sign-up" || kind === "sign-in" || kind === "reset-password") && (
          <Field data-invalid={Boolean(fieldErrors.password)}>
            <FieldLabel htmlFor="password">
              {kind === "reset-password" ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
            </FieldLabel>
            <Input
              id="password"
              name={kind === "reset-password" ? "newPassword" : "password"}
              type="password"
              autoComplete={kind === "sign-in" ? "current-password" : "new-password"}
              minLength={12}
              maxLength={128}
              required
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={[
                kind === "sign-in" ? undefined : "password-description",
                fieldErrors.password ? "password-error" : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
              onInput={clearInvalid}
            />
            {kind !== "sign-in" && (
              <FieldDescription id="password-description">
                ใช้รหัสผ่านที่มีความยาว 12–128 ตัวอักษร
              </FieldDescription>
            )}
            <FieldError id="password-error">{fieldErrors.password}</FieldError>
          </Field>
        )}

        {kind === "sign-up" && (
          <>
            <Field
              data-invalid={Boolean(fieldErrors.ageAttested)}
              orientation="horizontal"
            >
              <Checkbox
                id="ageAttested"
                name="ageAttested"
                value="on"
                isInvalid={Boolean(fieldErrors.ageAttested)}
                isRequired
                aria-describedby={
                  fieldErrors.ageAttested ? "ageAttested-error" : undefined
                }
                onChange={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    ageAttested: undefined,
                  }))
                }
              />
              <FieldLabel htmlFor="ageAttested">
                ฉันยืนยันว่ามีอายุ 18 ปีขึ้นไป
              </FieldLabel>
            </Field>
            <FieldError id="ageAttested-error">
              {fieldErrors.ageAttested}
            </FieldError>
            <FieldDescription>
              เมื่อสร้างบัญชี คุณยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว
            </FieldDescription>
            <Input name="termsVersion" type="hidden" value={termsVersion} />
            <Input name="privacyVersion" type="hidden" value={privacyVersion} />
            <Input name="callbackPath" type="hidden" value="/verify-email" />
          </>
        )}

        {kind === "sign-in" && (
          <Input name="callbackPath" type="hidden" value="/" />
        )}
        {kind === "forgot-password" && (
          <Input name="redirectPath" type="hidden" value="/reset-password" />
        )}
        {kind === "reset-password" && (
          <Input name="token" type="hidden" value={resetToken} />
        )}

        <Button type="submit" isDisabled={submitting} className="w-full">
          {submitting && <Spinner data-icon="inline-start" />}
          {submitting ? actionLabels[kind].pending : actionLabels[kind].idle}
        </Button>

        {status && (
          <Alert variant={status.tone === "error" ? "destructive" : "default"}>
            <AlertTitle>
              {status.tone === "success" ? "ดำเนินการแล้ว" : "ยังดำเนินการไม่ได้"}
            </AlertTitle>
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
    </form>
  );
}
