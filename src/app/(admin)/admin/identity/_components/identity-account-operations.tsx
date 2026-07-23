"use client";

import {
  KeyRoundIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

type GlobalRole =
  | "reviewer"
  | "support_operator"
  | "finance_operator"
  | "platform_admin";

type Account = {
  accountId: string;
  displayName: string;
  email?: string | null;
  status: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt?: string;
  activeGlobalRoles?: GlobalRole[];
};

type AuditEvent = {
  id: string;
  action: string;
  actorType: string;
  actorAccountId: string | null;
  reasonCode: string | null;
  occurredAt: string;
};

type AccountResponse = {
  account: Account;
  audit: AuditEvent[];
  capabilities: {
    canManageLifecycle: boolean;
    canManageRoles: boolean;
    canRevokeSessions: boolean;
    selfMutationForbidden: boolean;
  };
};

type ActionName =
  | "revoke_sessions"
  | "suspend"
  | "reactivate"
  | "grant_role"
  | "revoke_role";

async function requestAccount(accountId: string): Promise<AccountResponse> {
  const response = await fetch(`/api/admin/identity/accounts/${accountId}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("request failed");
  return response.json() as Promise<AccountResponse>;
}

const roleOptions: Array<{ value: GlobalRole; label: string }> = [
  { value: "reviewer", label: "Reviewer" },
  { value: "support_operator", label: "Support operator" },
  { value: "finance_operator", label: "Finance operator" },
  { value: "platform_admin", label: "Platform admin" },
];

function AccountActionDialog({
  accountId,
  action,
  title,
  description,
  trigger,
  destructive = false,
  disabled = false,
  roles,
  onCompleted,
}: {
  accountId: string;
  action: ActionName;
  title: string;
  description: string;
  trigger: string;
  destructive?: boolean;
  disabled?: boolean;
  roles?: GlobalRole[];
  onCompleted(message: string): void;
}) {
  const [reason, setReason] = useState("");
  const [selectedRole, setSelectedRole] = useState<GlobalRole>(
    roles?.[0] ?? "reviewer",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const validReason = /^[a-z0-9][a-z0-9_.-]{2,63}$/.test(reason);

  async function submit() {
    if (!validReason) {
      setError("ใช้ reason code ตัวพิมพ์เล็ก 3–64 ตัว เช่น support_case_123");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/admin/identity/accounts/${accountId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            reasonCode: reason,
            ...(action === "grant_role" || action === "revoke_role"
              ? { role: selectedRole }
              : {}),
          }),
        },
      );
      if (!response.ok) throw new Error("request failed");
      await onCompleted("บันทึกการเปลี่ยนแปลงพร้อม audit แล้ว");
      setReason("");
      setOpen(false);
    } catch {
      setError(
        "ดำเนินการไม่สำเร็จ สิทธิ์หรือสถานะอาจเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialogTrigger
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (pending) return;
        setOpen(nextOpen);
        if (!nextOpen) {
          setError(null);
          setReason("");
        }
      }}
    >
      <Button
        type="button"
        variant={destructive ? "destructive" : "outline"}
        isDisabled={disabled}
      >
        {trigger}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          {roles ? (
            <Field data-disabled={pending ? true : undefined}>
              <FieldLabel htmlFor={`${action}-role`}>บทบาทส่วนกลาง</FieldLabel>
              <NativeSelect
                id={`${action}-role`}
                value={selectedRole}
                onChange={(event) =>
                  setSelectedRole(event.target.value as GlobalRole)
                }
                disabled={pending}
                className="w-full"
              >
                {roles.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {roleOptions.find((option) => option.value === value)?.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field
            data-invalid={error ? true : undefined}
            data-disabled={pending ? true : undefined}
          >
            <FieldLabel htmlFor={`${action}-reason`}>Reason code</FieldLabel>
            <Input
              id={`${action}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={error ? true : undefined}
              disabled={pending}
              autoComplete="off"
              autoFocus
            />
            <FieldDescription>
              ห้ามใส่อีเมล ชื่อ หรือรายละเอียดเคสที่เป็นข้อมูลส่วนบุคคล
            </FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={pending}>
            ยกเลิก
          </AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            isDisabled={pending}
            onPress={() => void submit()}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "กำลังบันทึก…" : "ยืนยันการดำเนินการ"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogTrigger>
  );
}

export function IdentityAccountOperations({
  accountId,
}: {
  accountId: string;
}) {
  const [data, setData] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await requestAccount(accountId));
    } catch {
      setError(
        "โหลดข้อมูลบัญชีไม่ได้ ตรวจสอบ session, MFA และสิทธิ์ก่อนลองใหม่",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    let active = true;
    void requestAccount(accountId)
      .then((response) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) {
          setError(
            "โหลดข้อมูลบัญชีไม่ได้ ตรวจสอบ session, MFA และสิทธิ์ก่อนลองใหม่",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId]);

  async function completed(message: string) {
    setStatus(message);
    await load();
  }

  if (loading && !data) {
    return (
      <Card className="max-w-3xl" aria-busy="true">
        <CardHeader>
          <CardTitle>กำลังโหลดข้อมูลบัญชี</CardTitle>
          <CardDescription>
            ระบบกำลังตรวจ session และสิทธิ์ล่าสุดจากฐานข้อมูล
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          กรุณารอสักครู่…
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>เปิดรายละเอียดไม่ได้</AlertTitle>
        <AlertDescription>{error ?? "ไม่พบข้อมูลบัญชี"}</AlertDescription>
        <Button className="mt-3" variant="outline" onPress={() => void load()}>
          <RefreshCwIcon data-icon="inline-start" />
          ลองใหม่
        </Button>
      </Alert>
    );
  }

  const { account, capabilities } = data;
  const activeRoles = account.activeGlobalRoles ?? [];
  const grantableRoles = roleOptions
    .map(({ value }) => value)
    .filter((value) => !activeRoles.includes(value));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {status ? (
        <Alert className="lg:col-span-2" aria-live="polite">
          <AlertTitle>บันทึกแล้ว</AlertTitle>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}
      {capabilities.selfMutationForbidden ? (
        <Alert className="lg:col-span-2">
          <ShieldAlertIcon />
          <AlertTitle>บัญชีของผู้ดำเนินการ</AlertTitle>
          <AlertDescription>
            ระบบปิดการเปลี่ยนสถานะ บทบาท และ security state ของตนเอง
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{account.displayName}</CardTitle>
          <CardDescription className="break-all">
            {account.email ?? "Support view ไม่เปิดเผยอีเมล"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{account.status}</Badge>
            <Badge variant="outline">
              {account.emailVerified ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}
            </Badge>
            <Badge variant="outline">
              {account.twoFactorEnabled ? "เปิด 2FA" : "ยังไม่เปิด 2FA"}
            </Badge>
          </div>
          <Separator />
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Account UUID</dt>
              <dd className="break-all">{account.accountId}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">สร้างเมื่อ</dt>
              <dd>
                {account.createdAt
                  ? new Intl.DateTimeFormat("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Bangkok",
                    }).format(new Date(account.createdAt))
                  : "ข้อมูลจำกัดสำหรับ Support"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security operations</CardTitle>
          <CardDescription>
            ทุก action ตรวจ session, MFA, role และ target ซ้ำฝั่ง server
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {capabilities.canRevokeSessions ? (
            <AccountActionDialog
              accountId={accountId}
              action="revoke_sessions"
              title="เพิกถอน session ทั้งหมดของบัญชีนี้?"
              description="ผู้ใช้จะต้องเข้าสู่ระบบใหม่ทุกอุปกรณ์ การดำเนินการนี้สร้าง audit พร้อม reason code"
              trigger="เพิกถอน session"
              destructive
              disabled={capabilities.selfMutationForbidden}
              onCompleted={(message) => void completed(message)}
            />
          ) : null}
          {capabilities.canManageLifecycle && account.status === "active" ? (
            <AccountActionDialog
              accountId={accountId}
              action="suspend"
              title="ระงับบัญชีนี้?"
              description="บัญชีจะใช้ session เดิมไม่ได้ และระบบเพิกถอน session ทั้งหมดใน transaction เดียวกัน"
              trigger="ระงับบัญชี"
              destructive
              disabled={capabilities.selfMutationForbidden}
              onCompleted={(message) => void completed(message)}
            />
          ) : null}
          {capabilities.canManageLifecycle && account.status === "suspended" ? (
            <AccountActionDialog
              accountId={accountId}
              action="reactivate"
              title="เปิดใช้งานบัญชีอีกครั้ง?"
              description="บัญชีจะกลับเป็น active แต่ session เดิมไม่ถูกสร้างคืน"
              trigger="เปิดใช้งานอีกครั้ง"
              disabled={capabilities.selfMutationForbidden}
              onCompleted={(message) => void completed(message)}
            />
          ) : null}
          {!capabilities.canRevokeSessions &&
          !capabilities.canManageLifecycle ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRoundIcon />
                </EmptyMedia>
                <EmptyTitle>ไม่มี action สำหรับ role นี้</EmptyTitle>
                <EmptyDescription>
                  Reviewer และ Finance operator ไม่มี privileged Identity
                  mutation ใน WP-01
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </CardContent>
      </Card>

      {capabilities.canManageRoles ? (
        <Card>
          <CardHeader>
            <CardTitle>บทบาทส่วนกลาง</CardTitle>
            <CardDescription>
              Platform admin ห้าม grant หรือ revoke role ของตนเอง
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {activeRoles.length ? (
                activeRoles.map((value) => (
                  <Badge key={value} variant="secondary">
                    {roleOptions.find((option) => option.value === value)?.label}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  ไม่มี global role ที่ active
                </span>
              )}
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {grantableRoles.length ? (
                <AccountActionDialog
                  accountId={accountId}
                  action="grant_role"
                  title="เพิ่มบทบาทส่วนกลาง?"
                  description="สิทธิ์มีผลกับ request ถัดไปจากฐานข้อมูล และ Platform admin ต้องเปิด 2FA แล้ว"
                  trigger="เพิ่มบทบาท"
                  roles={grantableRoles}
                  disabled={capabilities.selfMutationForbidden}
                  onCompleted={(message) => void completed(message)}
                />
              ) : null}
              {activeRoles.length ? (
                <AccountActionDialog
                  accountId={accountId}
                  action="revoke_role"
                  title="ถอนบทบาทส่วนกลาง?"
                  description="สิทธิ์จะหยุดใน request ถัดไปและสร้าง audit ใน transaction เดียวกัน"
                  trigger="ถอนบทบาท"
                  roles={activeRoles}
                  destructive
                  disabled={capabilities.selfMutationForbidden}
                  onCompleted={(message) => void completed(message)}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {capabilities.canManageRoles ? (
        <Card>
          <CardHeader>
            <CardTitle>Identity audit</CardTitle>
            <CardDescription>
              เหตุการณ์ล่าสุด 50 รายการ ไม่รวม password, token หรืออีเมล
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.audit.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UserRoundIcon />
                  </EmptyMedia>
                  <EmptyTitle>ยังไม่มี audit event</EmptyTitle>
                  <EmptyDescription>
                    เหตุการณ์ที่มี audit จะปรากฏที่นี่
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ol className="flex flex-col gap-3">
                {data.audit.map((event) => (
                  <li key={event.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{event.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.reasonCode ?? "ไม่มี reason code"} ·{" "}
                      {new Intl.DateTimeFormat("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Bangkok",
                      }).format(new Date(event.occurredAt))}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
