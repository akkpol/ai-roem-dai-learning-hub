"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Tone = "success" | "error";
type Status = { tone: Tone; message: string } | null;

async function send(url: string, method: string, values: Record<string, string>) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
  const result: unknown = await response.json().catch(() => null);
  const message =
    result && typeof result === "object" && "message" in result && typeof result.message === "string"
      ? result.message
      : "กรุณาลองใหม่";
  if (!response.ok) throw new Error(message);
  return result as Record<string, unknown>;
}

function valuesOf(form: HTMLFormElement) {
  return Object.fromEntries(
    [...new FormData(form)].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function StatusAlert({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <Alert variant={status.tone === "error" ? "destructive" : "default"}>
      <AlertTitle>{status.tone === "error" ? "ยังดำเนินการไม่ได้" : "ดำเนินการแล้ว"}</AlertTitle>
      <AlertDescription>{status.message}</AlertDescription>
    </Alert>
  );
}

function SubmitButton({ pending, idle, busy }: { pending: string; idle: string; busy: boolean }) {
  return (
    <Button type="submit" isDisabled={busy}>
      {busy && <Spinner data-icon="inline-start" />}
      {busy ? pending : idle}
    </Button>
  );
}

export function ProfileForm() {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({ displayName: "", locale: "th-TH", timeZone: "Asia/Bangkok" });
  useEffect(() => {
    let active = true;
    fetch("/api/account/profile")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((value) => active && setProfile(value))
      .catch(() => active && setStatus({ tone: "error", message: "โหลดโปรไฟล์ไม่ได้ กรุณาลองใหม่" }));
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await send("/api/account/profile", "PATCH", valuesOf(event.currentTarget));
      setStatus({ tone: "success", message: "บันทึกโปรไฟล์แล้ว" });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "กรุณาลองใหม่" });
    } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader><CardTitle>โปรไฟล์ของฉัน</CardTitle><CardDescription>แก้ไขชื่อ ภาษา และเขตเวลา อีเมลใช้ขั้นตอนยืนยันแยกต่างหาก</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} aria-busy={busy}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="displayName">ชื่อที่แสดง</FieldLabel><Input id="displayName" name="displayName" required maxLength={120} autoComplete="name" value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} /></Field>
            <Field><FieldLabel htmlFor="locale">ภาษา</FieldLabel><Input id="locale" name="locale" required value={profile.locale} onChange={(event) => setProfile((current) => ({ ...current, locale: event.target.value }))} /><FieldDescription>ใช้รหัสภาษา เช่น th-TH หรือ en-US</FieldDescription></Field>
            <Field><FieldLabel htmlFor="timeZone">เขตเวลา</FieldLabel><Input id="timeZone" name="timeZone" required value={profile.timeZone} onChange={(event) => setProfile((current) => ({ ...current, timeZone: event.target.value }))} /><FieldDescription>ใช้ชื่อเขตเวลา IANA เช่น Asia/Bangkok</FieldDescription></Field>
            <SubmitButton busy={busy} idle="บันทึกโปรไฟล์" pending="กำลังบันทึก…" />
            <StatusAlert status={status} />
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

type Device = { id: string; current: boolean; userAgent: string | null; lastSeenAt: string };

function SessionsCard() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const load = () => {
    setDevices(null);
    setStatus(null);
    fetch("/api/account/sessions")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setDevices)
      .catch(() => setStatus({ tone: "error", message: "โหลดรายการอุปกรณ์ไม่ได้" }));
  };
  useEffect(() => {
    let active = true;
    fetch("/api/account/sessions")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((rows) => active && setDevices(rows))
      .catch(() => active && setStatus({ tone: "error", message: "โหลดรายการอุปกรณ์ไม่ได้" }));
    return () => { active = false; };
  }, []);
  async function revoke(sessionId: string) {
    try {
      await send("/api/account/sessions", "DELETE", { sessionId });
      setDevices((current) => current?.filter((device) => device.id !== sessionId) ?? []);
      setStatus({ tone: "success", message: "เพิกถอนอุปกรณ์แล้ว" });
    } catch { setStatus({ tone: "error", message: "เพิกถอนอุปกรณ์ไม่ได้" }); }
  }
  async function revokeOthers() {
    try {
      await send("/api/account/sessions/revoke-others", "POST", {});
      setDevices((current) => current?.filter((device) => device.current) ?? []);
      setStatus({ tone: "success", message: "ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว" });
    } catch { setStatus({ tone: "error", message: "ออกจากระบบอุปกรณ์อื่นไม่ได้" }); }
  }
  return (
    <Card>
      <CardHeader><CardTitle>อุปกรณ์และเซสชัน</CardTitle><CardDescription>ตรวจสอบและเพิกถอนเซสชันที่ไม่รู้จัก</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {devices === null && !status ? <p className="flex items-center gap-2 text-muted-foreground"><Spinner />กำลังโหลดอุปกรณ์…</p> : null}
        {devices?.length === 0 ? <Empty><EmptyHeader><EmptyTitle>ไม่มีอุปกรณ์อื่น</EmptyTitle><EmptyDescription>มีเฉพาะเซสชันปัจจุบันหรือไม่มีเซสชันที่ใช้งานอยู่</EmptyDescription></EmptyHeader></Empty> : null}
        {devices?.map((device) => <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between" key={device.id}><div><p>{device.userAgent ?? "อุปกรณ์ไม่ทราบชื่อ"}</p><p className="text-sm text-muted-foreground">ใช้งานล่าสุด {device.lastSeenAt}</p></div><div className="flex items-center gap-2">{device.current ? <Badge>เครื่องนี้</Badge> : <Button variant="outline" size="sm" onPress={() => revoke(device.id)}>เพิกถอน</Button>}</div></div>)}
        <StatusAlert status={status} />
        {status?.tone === "error" && <Button variant="outline" onPress={load}>ลองโหลดอีกครั้ง</Button>}
      </CardContent>
      <CardFooter><Button variant="outline" onPress={revokeOthers}>ออกจากระบบอุปกรณ์อื่นทั้งหมด</Button></CardFooter>
    </Card>
  );
}

function PasswordCard() {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus(null);
    try { await send("/api/account/password", "POST", valuesOf(event.currentTarget)); event.currentTarget.reset(); setStatus({ tone: "success", message: "เปลี่ยนรหัสผ่านและเพิกถอนเซสชันอื่นแล้ว" }); }
    catch { setStatus({ tone: "error", message: "เปลี่ยนรหัสผ่านไม่ได้ กรุณายืนยันตัวตนใหม่" }); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>เปลี่ยนรหัสผ่าน</CardTitle><CardDescription>ต้องเป็นเซสชันที่ยืนยันภายใน 10 นาที</CardDescription></CardHeader><CardContent><form onSubmit={submit}><FieldGroup><Field><FieldLabel htmlFor="currentPassword">รหัสผ่านปัจจุบัน</FieldLabel><Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required /></Field><Field><FieldLabel htmlFor="newPassword">รหัสผ่านใหม่</FieldLabel><Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></Field><SubmitButton busy={busy} idle="เปลี่ยนรหัสผ่าน" pending="กำลังเปลี่ยน…" /><StatusAlert status={status} /></FieldGroup></form></CardContent></Card>;
}

function TwoFactorCard() {
  const [step, setStep] = useState<"password" | "verify" | "recovery">("password");
  const [enrollment, setEnrollment] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus(null);
    try { const result = await send("/api/account/two-factor/enroll", "POST", valuesOf(event.currentTarget)); setEnrollment({ totpURI: String(result.totpURI), backupCodes: Array.isArray(result.backupCodes) ? result.backupCodes.map(String) : [] }); setStep("verify"); }
    catch { setStatus({ tone: "error", message: "เริ่มตั้งค่า 2FA ไม่ได้" }); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus(null);
    try { await send("/api/account/two-factor/confirm", "POST", valuesOf(event.currentTarget)); setStep("recovery"); setStatus({ tone: "success", message: "เปิด 2FA แล้ว โปรดเก็บรหัสกู้คืนก่อนออกจากหน้านี้" }); }
    catch { setStatus({ tone: "error", message: "รหัสไม่ถูกต้องหรือหมดอายุ" }); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>แอปยืนยันตัวตน</CardTitle><CardDescription>ตั้งค่าเป็นขั้นตอน ระบบไม่จดจำอุปกรณ์ที่เชื่อถือได้</CardDescription></CardHeader><CardContent>
    {step === "password" && <form onSubmit={begin}><FieldGroup><Field><FieldLabel htmlFor="twoFactorPassword">1. ยืนยันรหัสผ่าน</FieldLabel><Input id="twoFactorPassword" name="password" type="password" autoComplete="current-password" required /></Field><SubmitButton busy={busy} idle="เริ่มตั้งค่า 2FA" pending="กำลังเริ่ม…" /><StatusAlert status={status} /></FieldGroup></form>}
    {step === "verify" && <form onSubmit={verify}><FieldGroup><Alert><AlertTitle>2. เพิ่มบัญชีในแอป</AlertTitle><AlertDescription className="break-all">{enrollment?.totpURI}</AlertDescription></Alert><Field><FieldLabel htmlFor="twoFactorCode">กรอกรหัส 6 หลักแรก</FieldLabel><Input id="twoFactorCode" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required /></Field><SubmitButton busy={busy} idle="ยืนยันและเปิด 2FA" pending="กำลังยืนยัน…" /><StatusAlert status={status} /></FieldGroup></form>}
    {step === "recovery" && <div className="flex flex-col gap-4"><StatusAlert status={status} /><Alert><AlertTitle>3. บันทึกรหัสกู้คืนครั้งเดียว</AlertTitle><AlertDescription><ul className="mt-2 grid gap-1 font-mono">{enrollment?.backupCodes.map((code) => <li key={code}>{code}</li>)}</ul></AlertDescription></Alert><Button variant="outline" onPress={() => { setEnrollment(null); setStep("password"); setStatus(null); }}>ฉันบันทึกรหัสแล้ว</Button></div>}
  </CardContent></Card>;
}

function RecoveryAndDisableCard() {
  const [recoveryStatus, setRecoveryStatus] = useState<Status>(null);
  const [disableStatus, setDisableStatus] = useState<Status>(null);
  async function submit(url: string, event: FormEvent<HTMLFormElement>, setStatus: (status: Status) => void) {
    event.preventDefault(); setStatus(null);
    try { const result = await send(url, "POST", valuesOf(event.currentTarget)); const codes = Array.isArray(result.backupCodes) ? ` รหัสใหม่: ${result.backupCodes.join(" · ")}` : ""; setStatus({ tone: "success", message: `ดำเนินการแล้ว${codes}` }); }
    catch { setStatus({ tone: "error", message: "ดำเนินการไม่ได้ กรุณายืนยันตัวตนใหม่" }); }
  }
  return <Card><CardHeader><CardTitle>รหัสกู้คืนและการปิด 2FA</CardTitle><CardDescription>รหัสกู้คืนใช้ได้ครั้งเดียว ชุดใหม่ทำให้ชุดเดิมใช้ไม่ได้</CardDescription></CardHeader><CardContent className="grid gap-6 md:grid-cols-2"><form onSubmit={(event) => submit("/api/account/two-factor/recovery-codes", event, setRecoveryStatus)}><FieldGroup><Field><FieldLabel htmlFor="recoveryPassword">รหัสผ่าน</FieldLabel><Input id="recoveryPassword" name="password" type="password" autoComplete="current-password" required /></Field><Button type="submit" variant="outline">สร้างรหัสกู้คืนชุดใหม่</Button><StatusAlert status={recoveryStatus} /></FieldGroup></form><form onSubmit={(event) => submit("/api/account/two-factor/disable", event, setDisableStatus)}><FieldGroup><Field><FieldLabel htmlFor="disablePassword">รหัสผ่าน</FieldLabel><Input id="disablePassword" name="password" type="password" autoComplete="current-password" required /></Field><Field><FieldLabel htmlFor="disableTotp">รหัส TOTP หรือเว้นไว้เพื่อใช้รหัสกู้คืน</FieldLabel><Input id="disableTotp" name="totpCode" inputMode="numeric" /></Field><Field><FieldLabel htmlFor="disableRecovery">รหัสกู้คืน</FieldLabel><Input id="disableRecovery" name="recoveryCode" autoComplete="one-time-code" /></Field><Button type="submit" variant="destructive">ปิด 2FA</Button><StatusAlert status={disableStatus} /></FieldGroup></form></CardContent></Card>;
}

export function SecurityForms() {
  return <div className="grid gap-4 lg:grid-cols-2"><SessionsCard /><PasswordCard /><TwoFactorCard /><RecoveryAndDisableCard /></div>;
}

type Policy = { type: string; version: string; acceptedAt: string };

export function PrivacyForms() {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [policyStatus, setPolicyStatus] = useState<Status>(null);
  const [exportStatus, setExportStatus] = useState<Status>(null);
  const [deletionStatus, setDeletionStatus] = useState<Status>(null);
  const [cancellationStatus, setCancellationStatus] = useState<Status>(null);
  const deletionForm = useRef<HTMLFormElement>(null);
  useEffect(() => { fetch("/api/account/policies").then((response) => response.ok ? response.json() : Promise.reject()).then(setPolicies).catch(() => setPolicyStatus({ tone: "error", message: "โหลดประวัตินโยบายไม่ได้" })); }, []);
  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setExportStatus(null);
    const response = await fetch("/api/account/privacy/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(valuesOf(event.currentTarget)) });
    if (!response.ok) { setExportStatus({ tone: "error", message: "กรุณายืนยันตัวตนใหม่" }); return; }
    const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "learning-hub-identity.json"; anchor.click(); URL.revokeObjectURL(url); setExportStatus({ tone: "success", message: "ดาวน์โหลดข้อมูลแล้ว" });
  }
  async function requestDeletion() {
    if (!deletionForm.current) return;
    try { await send("/api/account/privacy/deletion/request", "POST", valuesOf(deletionForm.current)); setDeletionStatus({ tone: "success", message: "ส่งอีเมลยืนยันแล้ว การเปิดอีเมลยังไม่ลบบัญชีจนกว่าคุณจะกดยืนยัน" }); }
    catch { setDeletionStatus({ tone: "error", message: "ส่งคำขอลบบัญชีไม่ได้" }); }
  }
  async function cancel(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setCancellationStatus(null); try { await send("/api/account/privacy/deletion/cancel", "POST", valuesOf(event.currentTarget)); setCancellationStatus({ tone: "success", message: "ยกเลิกการลบบัญชีแล้ว" }); } catch { setCancellationStatus({ tone: "error", message: "ยกเลิกไม่ได้ กรุณาตรวจสอบข้อมูล" }); } }
  return <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>ประวัตินโยบาย</CardTitle><CardDescription>เวอร์ชันข้อกำหนดที่คุณเคยยอมรับ</CardDescription></CardHeader><CardContent>{policies === null && !policyStatus ? <p className="flex items-center gap-2 text-muted-foreground"><Spinner />กำลังโหลด…</p> : null}{policies?.length === 0 ? <Empty><EmptyHeader><EmptyTitle>ยังไม่มีประวัติเพิ่มเติม</EmptyTitle><EmptyDescription>ประวัติจะแสดงเมื่อคุณยอมรับนโยบาย</EmptyDescription></EmptyHeader></Empty> : null}<ul className="flex flex-col gap-2">{policies?.map((policy) => <li className="rounded-lg border border-border p-3" key={`${policy.type}-${policy.version}`}>{policy.type} · {policy.version}<p className="text-sm text-muted-foreground">{policy.acceptedAt}</p></li>)}</ul><StatusAlert status={policyStatus} /></CardContent></Card>
    <Card><CardHeader><CardTitle>ดาวน์โหลดข้อมูล Identity</CardTitle><CardDescription>ไฟล์ JSON ไม่รวมรหัสผ่าน token หรือข้อมูลของผู้อื่น</CardDescription></CardHeader><CardContent><form onSubmit={download}><FieldGroup><Field><FieldLabel htmlFor="exportTotp">รหัส TOTP เมื่อเปิด 2FA</FieldLabel><Input id="exportTotp" name="totpCode" inputMode="numeric" /></Field><Field><FieldLabel htmlFor="exportRecovery">หรือรหัสกู้คืน</FieldLabel><Input id="exportRecovery" name="recoveryCode" /></Field><Button type="submit">ดาวน์โหลด JSON</Button><StatusAlert status={exportStatus} /></FieldGroup></form></CardContent></Card>
    <Card><CardHeader><CardTitle>ขอลบบัญชี</CardTitle><CardDescription>หลังยืนยันทางอีเมล ระบบจะออกจากทุกอุปกรณ์และเริ่มช่วงรอ 7 วัน</CardDescription></CardHeader><CardContent><form ref={deletionForm}><FieldGroup><Field><FieldLabel htmlFor="deletionPassword">รหัสผ่าน</FieldLabel><Input id="deletionPassword" name="password" type="password" autoComplete="current-password" required /></Field><Field><FieldLabel htmlFor="deletionTotp">รหัส TOTP</FieldLabel><Input id="deletionTotp" name="totpCode" inputMode="numeric" /></Field><Field><FieldLabel htmlFor="deletionRecovery">หรือรหัสกู้คืน</FieldLabel><Input id="deletionRecovery" name="recoveryCode" /></Field><AlertDialogTrigger><Button type="button" variant="destructive">ตรวจสอบก่อนส่งคำขอ</Button><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ส่งคำขอลบบัญชี?</AlertDialogTitle><AlertDialogDescription>ระบบจะส่งอีเมลยืนยัน การกดยืนยันในอีเมลจะออกจากทุกอุปกรณ์และเริ่มช่วงรอ 7 วัน</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>กลับไปตรวจสอบ</AlertDialogCancel><AlertDialogAction variant="destructive" onPress={requestDeletion}>ส่งอีเมลยืนยัน</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialogTrigger><StatusAlert status={deletionStatus} /></FieldGroup></form></CardContent></Card>
    <Card><CardHeader><CardTitle>ยกเลิกการลบบัญชี</CardTitle><CardDescription>ใช้ได้เฉพาะในช่วงรอ และจะสร้างเซสชันใหม่หลังยืนยันสำเร็จ</CardDescription></CardHeader><CardContent><form onSubmit={cancel}><FieldGroup><Field><FieldLabel htmlFor="cancelEmail">อีเมล</FieldLabel><Input id="cancelEmail" name="email" type="email" autoComplete="email" required /></Field><Field><FieldLabel htmlFor="cancelPassword">รหัสผ่าน</FieldLabel><Input id="cancelPassword" name="password" type="password" autoComplete="current-password" required /></Field><Field><FieldLabel htmlFor="cancelTotp">รหัส TOTP</FieldLabel><Input id="cancelTotp" name="totpCode" /></Field><Field><FieldLabel htmlFor="cancelRecovery">หรือรหัสกู้คืน</FieldLabel><Input id="cancelRecovery" name="recoveryCode" /></Field><Button type="submit" variant="outline">ยกเลิกและกลับเข้าใช้งาน</Button><StatusAlert status={cancellationStatus} /></FieldGroup></form></CardContent></Card></div>;
}
