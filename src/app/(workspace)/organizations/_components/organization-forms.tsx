"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizationWorkspaceDto } from "@/modules/organizations";

import {
  createOrganization,
  loadOrganizationWorkspace,
  type OrganizationIdentityValues,
  organizationMutationView,
  organizationWorkspaceView,
  updateOrganizationIdentity,
} from "./organization-client";

type FieldErrors = Record<string, string>;
type Feedback = { tone: "success" | "error"; message: string; code?: string; status?: number; fieldErrors?: FieldErrors } | null;

const initialValues: OrganizationIdentityValues = {
  displayName: "",
  slug: "",
  description: "",
  contactEmail: "",
  locale: "th-TH",
  timeZone: "Asia/Bangkok",
};

function IdentityFields({
  values,
  setValues,
  errors,
  disabled,
  includeSlug,
}: {
  values: typeof initialValues;
  setValues: React.Dispatch<React.SetStateAction<typeof initialValues>>;
  errors?: FieldErrors;
  disabled: boolean;
  includeSlug: boolean;
}) {
  const bind = (key: keyof typeof initialValues) => ({
    id: key,
    name: key,
    value: values[key],
    disabled,
    className: "min-h-11",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((current) => ({ ...current, [key]: event.target.value })),
  });
  const invalid = (key: keyof typeof initialValues) => Boolean(errors?.[key]);
  return <FieldGroup>
    <Field data-invalid={invalid("displayName") || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="displayName">ชื่อองค์กร</FieldLabel>
      <Input {...bind("displayName")} aria-invalid={invalid("displayName") || undefined} autoComplete="organization" />
      <FieldDescription>ใช้ชื่อภาษาไทยหรือภาษาอังกฤษได้</FieldDescription>
      <FieldError>{errors?.displayName}</FieldError>
    </Field>
    {includeSlug ? <Field data-invalid={invalid("slug") || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="slug">ชื่อ URL</FieldLabel>
      <Input {...bind("slug")} aria-invalid={invalid("slug") || undefined} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <FieldDescription>ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดกลางเท่านั้น และแก้ไขไม่ได้หลังสร้าง</FieldDescription>
      <FieldError>{errors?.slug}</FieldError>
    </Field> : null}
    <Field data-invalid={invalid("description") || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="description">คำอธิบาย</FieldLabel>
      <Textarea {...bind("description")} aria-invalid={invalid("description") || undefined} />
      <FieldDescription>ไม่จำเป็นต้องกรอก และยาวได้ไม่เกิน 1,000 ตัวอักษร</FieldDescription>
      <FieldError>{errors?.description}</FieldError>
    </Field>
    <Field data-invalid={invalid("contactEmail") || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="contactEmail">อีเมลติดต่อ</FieldLabel>
      <Input {...bind("contactEmail")} type="email" aria-invalid={invalid("contactEmail") || undefined} autoComplete="email" />
      <FieldError>{errors?.contactEmail}</FieldError>
    </Field>
    <Field data-invalid={invalid("locale") || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="locale">ภาษาเริ่มต้น</FieldLabel>
      <NativeSelect {...bind("locale")} className="min-h-11 [&>select]:min-h-11" aria-invalid={invalid("locale") || undefined}>
        <NativeSelectOption value="th-TH">ไทย</NativeSelectOption>
        <NativeSelectOption value="en-US">English</NativeSelectOption>
      </NativeSelect>
      <FieldError>{errors?.locale}</FieldError>
    </Field>
    <Field data-invalid={invalid("timeZone") || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor="timeZone">เขตเวลา</FieldLabel>
      <Input {...bind("timeZone")} aria-invalid={invalid("timeZone") || undefined} />
      <FieldDescription>เช่น Asia/Bangkok</FieldDescription>
      <FieldError>{errors?.timeZone}</FieldError>
    </Field>
  </FieldGroup>;
}

function FeedbackAlert({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <Alert variant={feedback.tone === "error" ? "destructive" : "default"}>
    {feedback.tone === "success" ? <CheckCircle2Icon aria-hidden="true" /> : null}
    <AlertTitle>{feedback.tone === "success" ? "บันทึกแล้ว" : "ดำเนินการไม่สำเร็จ"}</AlertTitle>
    <AlertDescription>{feedback.message}</AlertDescription>
  </Alert>;
}

function SubmitButton({ busy, children, pending }: { busy: boolean; children: string; pending: string }) {
  return <Button type="submit" size="lg" className="min-h-11" isDisabled={busy}>
    {busy ? <Spinner data-icon="inline-start" /> : <LoaderCircleIcon data-icon="inline-start" />}
    {busy ? pending : children}
  </Button>;
}

export function OrganizationCreateForm() {
  const [values, setValues] = useState(initialValues);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setFeedback(null);
    try {
      const result = await createOrganization(fetch, values);
      if (!result.ok) { setFeedback({ tone: "error", ...result }); return; }
      const workspace = result.workspace;
      setFeedback({ tone: "success", message: "สร้างองค์กรแล้ว กำลังเปิดพื้นที่ทำงาน" });
      window.location.assign(`/organizations/${workspace.organization.id}`);
    } catch {
      setFeedback({ tone: "error", message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" });
    } finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>ข้อมูลองค์กร</CardTitle><CardDescription>คุณจะเป็นเจ้าขององค์กรโดยอัตโนมัติหลังสร้าง</CardDescription></CardHeader><CardContent><form onSubmit={submit}><FieldGroup><IdentityFields values={values} setValues={setValues} errors={feedback?.fieldErrors} disabled={busy} includeSlug /><SubmitButton busy={busy} pending="กำลังสร้างองค์กร">สร้างองค์กร</SubmitButton><FeedbackAlert feedback={feedback} /></FieldGroup></form></CardContent></Card>;
}

export function OrganizationSettingsForm({ organizationId }: { organizationId: string }) {
  const [workspace, setWorkspace] = useState<OrganizationWorkspaceDto | null>(null);
  const [values, setValues] = useState(initialValues);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setFeedback(null);
    try {
      const result = await loadOrganizationWorkspace(fetch, organizationId);
      if (result.kind === "error") { setFeedback({ tone: "error", ...result }); return; }
      const data = result.workspace;
      setWorkspace(data); setValues({ displayName: data.organization.displayName, slug: data.organization.slug, description: data.organization.description ?? "", contactEmail: data.organization.contactEmail, locale: data.organization.locale, timeZone: data.organization.timeZone });
    } catch { setFeedback({ tone: "error", message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }); }
    finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!workspace) return;
    setBusy(true); setFeedback(null);
    try {
      const result = await updateOrganizationIdentity(fetch, organizationId, values, workspace.organization.version);
      if (!result.ok) { setFeedback({ tone: "error", ...result }); return; }
      setWorkspace(result.workspace); setFeedback({ tone: "success", message: "บันทึกข้อมูลองค์กรแล้ว" });
    } catch { setFeedback({ tone: "error", message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }); }
    finally { setBusy(false); }
  }
  const settingsState = loading
    ? { kind: "loading" as const }
    : workspace
      ? { kind: "success" as const, workspace }
      : { kind: "error" as const, message: feedback?.message ?? "ไม่สามารถโหลดองค์กรได้", status: feedback?.status, code: feedback?.code, fieldErrors: feedback?.fieldErrors };
  const settingsView = organizationWorkspaceView(settingsState);
  if (settingsView === "loading") return <p className="flex items-center gap-2 text-muted-foreground"><Spinner />กำลังโหลดข้อมูลองค์กร…</p>;
  if (settingsView === "forbidden") return <Alert variant="destructive"><AlertTitle>ไม่อนุญาต</AlertTitle><AlertDescription>คุณไม่มีสิทธิ์เปิดการตั้งค่าองค์กรนี้</AlertDescription></Alert>;
  if (settingsView === "retry") return <div className="flex flex-col gap-3"><FeedbackAlert feedback={feedback} /><Button variant="outline" className="min-h-11" onPress={() => void load()}>ลองอีกครั้ง</Button></div>;
  if (!workspace) return null;
  const canEdit = workspace.membership.role === "owner" || workspace.membership.role === "manager";
  if (!canEdit) return <Alert variant="destructive"><AlertTitle>ไม่อนุญาต</AlertTitle><AlertDescription>เฉพาะเจ้าของหรือผู้จัดการองค์กรเท่านั้นที่แก้ไขข้อมูลนี้ได้</AlertDescription></Alert>;
  return <Card><CardHeader><CardTitle>ข้อมูลที่แสดง</CardTitle><CardDescription>ชื่อ URL: {workspace.organization.slug}</CardDescription></CardHeader><CardContent><form onSubmit={submit}><FieldGroup><IdentityFields values={values} setValues={setValues} errors={feedback?.fieldErrors} disabled={busy} includeSlug={false} /><SubmitButton busy={busy} pending="กำลังบันทึก">บันทึกการเปลี่ยนแปลง</SubmitButton>{organizationMutationView(feedback?.code) === "stale" ? <Button type="button" variant="outline" className="min-h-11" onPress={() => void load()}>โหลดข้อมูลใหม่</Button> : null}<FeedbackAlert feedback={feedback} /></FieldGroup></form></CardContent></Card>;
}
