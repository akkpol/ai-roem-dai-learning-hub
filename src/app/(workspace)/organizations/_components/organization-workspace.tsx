"use client";

import { useCallback, useState } from "react";
import { ArrowRightIcon, Building2Icon, Settings2Icon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkButton, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrganizationListServerState, OrganizationWorkspaceServerState } from "@/modules/organizations";

import {
  loadOrganizationList,
  loadOrganizationWorkspace,
  organizationListView,
  organizationWorkspaceView,
  type OrganizationListRequest,
  type OrganizationWorkspaceRequest,
} from "./organization-client";

function LoadingCard() { return <Card><CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" /></CardHeader><CardContent className="flex flex-col gap-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></CardContent></Card>; }
function Retry({ detail, onRetry, forbidden }: { detail: string; onRetry: () => void; forbidden?: boolean }) { return <Alert variant="destructive"><AlertTitle>{forbidden ? "ไม่อนุญาต" : "โหลดข้อมูลไม่สำเร็จ"}</AlertTitle><AlertDescription className="flex flex-col gap-3"><span>{detail}</span>{!forbidden ? <Button variant="outline" className="min-h-11" onPress={onRetry}>ลองอีกครั้ง</Button> : null}</AlertDescription></Alert>; }

export function OrganizationList({ initialState }: { initialState: OrganizationListServerState }) {
  const [state, setState] = useState<{ kind: "loading" } | OrganizationListRequest>(initialState);
  const load = useCallback(async () => { setState({ kind: "loading" }); setState(await loadOrganizationList(fetch)); }, []);
  const view = organizationListView(state);
  const error = state.kind === "error" ? state : null;
  const organizations = state.kind === "success" ? state.organizations : [];
  return <section aria-labelledby="organizations-heading" className="flex flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 id="organizations-heading" className="font-heading text-2xl font-semibold">องค์กรของฉัน</h1><p className="text-muted-foreground">พื้นที่ทำงานของสถาบันและทีมที่คุณเป็นสมาชิก</p></div><LinkButton href="/organizations/new" size="lg" className="min-h-11">สร้างองค์กร<ArrowRightIcon data-icon="inline-end" /></LinkButton></div>{view === "loading" ? <LoadingCard /> : null}{view === "sign-in" ? <Alert><AlertTitle>กรุณาเข้าสู่ระบบ</AlertTitle><AlertDescription className="flex flex-col gap-3"><span>เข้าสู่ระบบเพื่อดูองค์กรที่คุณเป็นสมาชิก</span><LinkButton href="/sign-in" className="min-h-11">ไปยังหน้าเข้าสู่ระบบ</LinkButton></AlertDescription></Alert> : null}{view === "retry" || view === "forbidden" ? <Retry detail={error?.message ?? "ไม่สามารถโหลดองค์กรได้"} forbidden={view === "forbidden"} onRetry={() => void load()} /> : null}{view === "empty" ? <Empty><EmptyMedia variant="icon"><Building2Icon aria-hidden="true" /></EmptyMedia><EmptyHeader><EmptyTitle>ยังไม่มีองค์กร</EmptyTitle><EmptyDescription>สร้างองค์กรเพื่อเริ่มจัดการข้อมูลสถาบันและเตรียมความพร้อมของผู้สอน</EmptyDescription></EmptyHeader><EmptyContent><LinkButton href="/organizations/new" className="min-h-11">สร้างองค์กร</LinkButton></EmptyContent></Empty> : null}{view === "content" ? <ul className="flex flex-col gap-3">{organizations.map((organization) => <li key={organization.id}><Card><CardHeader><CardTitle>{organization.displayName}</CardTitle><CardDescription>ชื่อ URL: {organization.slug}</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">{organization.description || "ยังไม่มีคำอธิบายองค์กร"}</p><LinkButton href={`/organizations/${organization.id}`} variant="outline" className="min-h-11">เปิดพื้นที่ทำงาน<ArrowRightIcon data-icon="inline-end" /></LinkButton></CardContent></Card></li>)}</ul> : null}</section>;
}

export function OrganizationWorkspace({ organizationId, initialState }: { organizationId: string; initialState: OrganizationWorkspaceServerState }) {
  const [state, setState] = useState<{ kind: "loading" } | OrganizationWorkspaceRequest>(initialState);
  const load = useCallback(async () => { setState({ kind: "loading" }); setState(await loadOrganizationWorkspace(fetch, organizationId)); }, [organizationId]);
  const view = organizationWorkspaceView(state);
  if (view === "loading") return <LoadingCard />;
  if (view === "retry" || view === "forbidden") return <Retry detail={state.kind === "error" ? state.message : "ไม่สามารถโหลดองค์กรได้"} forbidden={view === "forbidden"} onRetry={() => void load()} />;
  if (state.kind !== "success") return null;
  const { organization, membership } = state.workspace;
  const canEdit = membership.role === "owner" || membership.role === "manager";
  return <section aria-labelledby="organization-heading" className="mx-auto flex max-w-3xl flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">องค์กร</p><h1 id="organization-heading" className="font-heading text-2xl font-semibold">{organization.displayName}</h1></div>{canEdit ? <LinkButton href={`/organizations/${organization.id}/settings`} size="lg" className="min-h-11"><Settings2Icon data-icon="inline-start" />ตั้งค่าองค์กร</LinkButton> : null}</div><Card><CardHeader><CardTitle>ข้อมูลองค์กร</CardTitle><CardDescription>ชื่อ URL: {organization.slug}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><p className="text-muted-foreground">{organization.description || "ยังไม่มีคำอธิบายองค์กร"}</p><Separator /><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">ภาษาเริ่มต้น</dt><dd>{organization.locale}</dd></div><div><dt className="text-muted-foreground">เขตเวลา</dt><dd>{organization.timeZone}</dd></div><div><dt className="text-muted-foreground">บทบาทของคุณ</dt><dd>{membership.role === "owner" ? "เจ้าของ" : membership.role === "manager" ? "ผู้จัดการ" : "สมาชิก"}</dd></div></dl></CardContent></Card><Card><CardHeader><CardTitle>ความพร้อมสำหรับการสอน</CardTitle><CardDescription>ติดตามขั้นตอนสำคัญก่อนส่งคำขอเป็นผู้สอน</CardDescription></CardHeader><CardContent><ol className="flex flex-col gap-4 border-l border-border pl-5 text-sm"><li><strong>1. สร้างองค์กรแล้ว</strong><p className="text-muted-foreground">คุณเป็นเจ้าขององค์กรนี้แล้ว</p></li><li><strong>2. เชิญสมาชิก</strong><p className="text-muted-foreground">เปิดให้ใช้งานในขั้นตอนถัดไป</p></li><li><strong>3. ส่งคำขอเป็นผู้สอน</strong><p className="text-muted-foreground">เตรียมข้อมูลเพื่อสมัครในนามองค์กร</p></li></ol></CardContent></Card></section>;
}
