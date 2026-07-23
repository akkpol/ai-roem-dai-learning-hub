"use client";

import { SearchIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Spinner } from "@/components/ui/spinner";

type Account = {
  accountId: string;
  displayName: string;
  status: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
};

const exactUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validLookup(value: string) {
  return (
    exactUuid.test(value) ||
    (value === value.trim() &&
      value === value.toLowerCase() &&
      value.length <= 320 &&
      exactEmail.test(value))
  );
}

export function IdentityAccountSearch() {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!validLookup(query)) {
      setFieldError(
        "กรอก UUID ที่สมบูรณ์ หรืออีเมลตัวพิมพ์เล็กที่ตรงทั้งหมดโดยไม่มีช่องว่าง",
      );
      return;
    }
    setFieldError(null);
    setRequestError(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/admin/identity/accounts?query=${encodeURIComponent(query)}`,
        { headers: { accept: "application/json" } },
      );
      if (!response.ok) throw new Error("request failed");
      const body = (await response.json()) as { accounts: Account[] };
      setAccounts(body.accounts);
    } catch {
      setRequestError(
        "ค้นหาบัญชีไม่ได้ในขณะนี้ ตรวจสอบ session และลองใหม่อีกครั้ง",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>ค้นหาบัญชี</CardTitle>
        <CardDescription>
          ผลลัพธ์แสดงเพียงหนึ่งบัญชีที่ตรงทั้งหมด และไม่รองรับ wildcard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={search} noValidate>
          <FieldGroup>
            <Field data-invalid={fieldError ? true : undefined}>
              <FieldLabel htmlFor="identity-account-query">
                UUID หรืออีเมลตัวพิมพ์เล็ก
              </FieldLabel>
              <Input
                id="identity-account-query"
                name="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby="identity-query-description"
                autoComplete="off"
                disabled={pending}
              />
              <FieldDescription id="identity-query-description">
                ตัวอย่าง person@example.com
              </FieldDescription>
              <FieldError>{fieldError}</FieldError>
            </Field>
            <Button type="submit" isDisabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SearchIcon data-icon="inline-start" />
              )}
              {pending ? "กำลังค้นหา…" : "ค้นหาบัญชี"}
            </Button>
          </FieldGroup>
        </form>

        <div className="mt-6" aria-live="polite">
          {requestError ? (
            <Alert variant="destructive">
              <AlertTitle>ค้นหาไม่สำเร็จ</AlertTitle>
              <AlertDescription>{requestError}</AlertDescription>
              <Button
                className="mt-3"
                variant="outline"
                onPress={() => void search()}
              >
                ลองใหม่
              </Button>
            </Alert>
          ) : null}
          {accounts === null && !requestError ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>ยังไม่ได้ค้นหา</EmptyTitle>
                <EmptyDescription>
                  กรอกตัวระบุแบบตรงทั้งหมดเพื่อเริ่มค้นหา
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {accounts?.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>ไม่พบบัญชีที่ตรงกัน</EmptyTitle>
                <EmptyDescription>
                  ตรวจสอบ UUID หรืออีเมล แล้วลองค้นหาใหม่
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {accounts?.map((account) => (
            <Card key={account.accountId} size="sm">
              <CardHeader>
                <CardTitle>{account.displayName}</CardTitle>
                <CardDescription className="break-all">
                  {account.accountId}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">{account.status}</Badge>
                <Badge variant="outline">
                  {account.emailVerified ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}
                </Badge>
                <Badge variant="outline">
                  {account.twoFactorEnabled ? "เปิด 2FA" : "ยังไม่เปิด 2FA"}
                </Badge>
              </CardContent>
              <CardFooter>
                <LinkButton
                  href={`/admin/identity/accounts/${account.accountId}`}
                >
                  เปิดรายละเอียด
                </LinkButton>
              </CardFooter>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
