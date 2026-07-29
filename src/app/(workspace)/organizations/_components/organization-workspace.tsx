"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRightIcon, Building2Icon, Settings2Icon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkButton, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrganizationSummaryDto, OrganizationWorkspaceDto } from "@/modules/organizations";

import { loadOrganizationList, loadOrganizationWorkspace } from "./organization-client";

type LoadState<T> = { value: T | null; message: string | null; loading: boolean; status?: number };

function LoadingCard() { return <Card><CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" /></CardHeader><CardContent className="flex flex-col gap-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></CardContent></Card>; }
function Retry({ detail, onRetry, forbidden }: { detail: string; onRetry: () => void; forbidden?: boolean }) { return <Alert variant="destructive"><AlertTitle>{forbidden ? "ไม่อนุญาต" : "โหลดข้อมูลไม่สำเร็จ"}</AlertTitle><AlertDescription className="flex flex-col gap-3"><span>{detail}</span>{!forbidden ? <Button variant="outline" className="min-h-11" onPress={onRetry}>ลองอีกครั้ง</Button> : null}</AlertDescription></Alert>; }

export function OrganizationList() {
  const [state, setState] = useState<LoadState<OrganizationSummaryDto[]>>({ value: null, message: null, loading: true });
  const load = useCallback(async () => { setState((current) => ({ ...current, loading: true, message: null })); const result = await loadOrganizationList(fetch); if (result.kind === "error") { setState({ value: null, message: result.message, loading: false, status: result.status }); return; } setState({ value: result.organizations, message: null, loading: false }); }, []);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  return <section aria-labelledby="organizations-heading" className="flex flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 id="organizations-heading" className="font-heading text-2xl font-semibold">องค์กรของฉัน</h1><p className="text-muted-foreground">พื้นที่ทำงานของสถาบันและทีมที่คุณเป็นสมาชิก</p></div><LinkButton href="/organizations/new" size="lg" className="min-h-11">สร้างองค์กร<ArrowRightIcon data-icon="inline-end" /></LinkButton></div>{state.loading ? <LoadingCard /> : null}{state.message ? <Retry detail={state.message} forbidden={state.status === 403} onRetry={() => void load()} /> : null}{state.value?.length === 0 ? <Empty><EmptyMedia variant="icon"><Building2Icon aria-hidden="true" /></EmptyMedia><EmptyHeader><EmptyTitle>ยังไม่มีองค์กร</EmptyTitle><EmptyDescription>สร้างองค์กรเพื่อเริ่มจัดการข้อมูลสถาบันและเตรียมความพร้อมของผู้สอน</EmptyDescription></EmptyHeader><EmptyContent><LinkButton href="/organizations/new" className="min-h-11">สร้างองค์กร</LinkButton></EmptyContent></Empty> : null}<ul className="flex flex-col gap-3">{state.value?.map((organization) => <li key={organization.id}><Card><CardHeader><CardTitle>{organization.displayName}</CardTitle><CardDescription>learninghub.example/organizations/{organization.slug}</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">{organization.description || "ยังไม่มีคำอธิบายองค์กร"}</p><LinkButton href={`/organizations/${organization.id}`} variant="outline" className="min-h-11">เปิดพื้นที่ทำงาน<ArrowRightIcon data-icon="inline-end" /></LinkButton></CardContent></Card></li>)}</ul></section>;
}

export function OrganizationWorkspace({ organizationId }: { organizationId: string }) {
  const [state, setState] = useState<LoadState<OrganizationWorkspaceDto>>({ value: null, message: null, loading: true });
  const load = useCallback(async () => { setState((current) => ({ ...current, loading: true, message: null })); const result = await loadOrganizationWorkspace(fetch, organizationId); if (result.kind === "error") { setState({ value: null, message: result.message, loading: false, status: result.status }); return; } setState({ value: result.workspace, message: null, loading: false }); }, [organizationId]);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  if (state.loading) return <LoadingCard />;
  if (state.message) return <Retry detail={state.message} forbidden={state.status === 403} onRetry={() => void load()} />;
  if (!state.value) return null;
  const { organization, membership } = state.value;
  const canEdit = membership.role === "owner" || membership.role === "manager";
  return <section aria-labelledby="organization-heading" className="mx-auto flex max-w-3xl flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">องค์กร</p><h1 id="organization-heading" className="font-heading text-2xl font-semibold">{organization.displayName}</h1></div>{canEdit ? <LinkButton href={`/organizations/${organization.id}/settings`} size="lg" className="min-h-11"><Settings2Icon data-icon="inline-start" />ตั้งค่าองค์กร</LinkButton> : null}</div><Card><CardHeader><CardTitle>ข้อมูลองค์กร</CardTitle><CardDescription>ชื่อ URL: {organization.slug}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><p className="text-muted-foreground">{organization.description || "ยังไม่มีคำอธิบายองค์กร"}</p><Separator /><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">ภาษาเริ่มต้น</dt><dd>{organization.locale}</dd></div><div><dt className="text-muted-foreground">เขตเวลา</dt><dd>{organization.timeZone}</dd></div><div><dt className="text-muted-foreground">บทบาทของคุณ</dt><dd>{membership.role === "owner" ? "เจ้าของ" : membership.role === "manager" ? "ผู้จัดการ" : "สมาชิก"}</dd></div></dl></CardContent></Card><Card><CardHeader><CardTitle>ความพร้อมสำหรับการสอน</CardTitle><CardDescription>ติดตามขั้นตอนสำคัญก่อนส่งคำขอเป็นผู้สอน</CardDescription></CardHeader><CardContent><ol className="flex flex-col gap-4 border-l border-border pl-5 text-sm"><li><strong>1. สร้างองค์กรแล้ว</strong><p className="text-muted-foreground">คุณเป็นเจ้าขององค์กรนี้แล้ว</p></li><li><strong>2. เชิญสมาชิก</strong><p className="text-muted-foreground">เปิดให้ใช้งานในขั้นตอนถัดไป</p></li><li><strong>3. ส่งคำขอเป็นผู้สอน</strong><p className="text-muted-foreground">เตรียมข้อมูลเพื่อสมัครในนามองค์กร</p></li></ol></CardContent></Card></section>;
}
