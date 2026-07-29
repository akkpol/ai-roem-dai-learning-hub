import type {
  OrganizationSummaryDto,
  OrganizationWorkspaceDto,
} from "@/modules/organizations";

export type OrganizationIdentityValues = {
  displayName: string;
  slug: string;
  description: string;
  contactEmail: string;
  locale: "th-TH" | "en-US";
  timeZone: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type OrganizationListRequest =
  | { kind: "success"; organizations: OrganizationSummaryDto[] }
  | { kind: "error"; message: string; status?: number };

export type OrganizationWorkspaceRequest =
  | { kind: "success"; workspace: OrganizationWorkspaceDto }
  | { kind: "error"; message: string; status?: number; code?: string; fieldErrors?: Record<string, string> };

export type OrganizationCreateRequest =
  | { ok: true; workspace: OrganizationWorkspaceDto }
  | { ok: false; message: string; status?: number; code?: string; fieldErrors?: Record<string, string> };

async function body(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function failure(response: Response, value: unknown, fallback: string) {
  const error = value as { message?: string; code?: string; fieldErrors?: Record<string, string> } | undefined;
  return {
    kind: "error" as const,
    message: error?.message ?? fallback,
    status: response.status,
    code: error?.code,
    fieldErrors: error?.fieldErrors,
  };
}

export function validateOrganizationCreate(values: OrganizationIdentityValues): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  if (values.displayName.trim().length < 2) fieldErrors.displayName = "กรอกชื่อองค์กรอย่างน้อย 2 ตัวอักษร";
  const slug = values.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) fieldErrors.slug = "ใช้ตัวอักษรอังกฤษ ตัวเลข และขีดกลาง 3–63 ตัวอักษร";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) fieldErrors.contactEmail = "กรอกอีเมลติดต่อให้ถูกต้อง";
  if (!values.timeZone.trim()) fieldErrors.timeZone = "กรอกเขตเวลา เช่น Asia/Bangkok";
  return fieldErrors;
}

export async function createOrganization(
  fetcher: Fetcher,
  values: OrganizationIdentityValues,
): Promise<OrganizationCreateRequest> {
  const fieldErrors = validateOrganizationCreate(values);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "กรุณาตรวจสอบข้อมูลที่กรอก", fieldErrors };
  }
  const response = await fetcher("/api/organizations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...values, description: values.description || undefined }),
  });
  const value = await body(response);
  if (!response.ok) {
    const error = failure(response, value, "ไม่สามารถสร้างองค์กรได้");
    return { ok: false, message: error.message, status: error.status, code: error.code, fieldErrors: error.fieldErrors };
  }
  return { ok: true, workspace: value as OrganizationWorkspaceDto };
}

export async function loadOrganizationList(fetcher: Fetcher = fetch): Promise<OrganizationListRequest> {
  try {
    const response = await fetcher("/api/organizations");
    const value = await body(response);
    if (!response.ok) return failure(response, value, "ไม่สามารถโหลดองค์กรได้");
    return { kind: "success", organizations: (value as { organizations: OrganizationSummaryDto[] }).organizations };
  } catch {
    return { kind: "error", message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export async function loadOrganizationWorkspace(
  fetcher: Fetcher = fetch,
  organizationId: string,
): Promise<OrganizationWorkspaceRequest> {
  try {
    const response = await fetcher(`/api/organizations/${organizationId}`);
    const value = await body(response);
    if (!response.ok) return failure(response, value, "ไม่สามารถโหลดองค์กรได้");
    return { kind: "success", workspace: value as OrganizationWorkspaceDto };
  } catch {
    return { kind: "error", message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export function organizationUpdatePayload(values: OrganizationIdentityValues, expectedVersion: number) {
  return {
    displayName: values.displayName,
    description: values.description || null,
    contactEmail: values.contactEmail,
    locale: values.locale,
    timeZone: values.timeZone,
    expectedVersion,
  };
}

export async function updateOrganizationIdentity(
  fetcher: Fetcher,
  organizationId: string,
  values: OrganizationIdentityValues,
  expectedVersion: number,
): Promise<{ ok: true; workspace: OrganizationWorkspaceDto } | { ok: false; message: string; status?: number; code?: string; fieldErrors?: Record<string, string> }> {
  try {
    const response = await fetcher(`/api/organizations/${organizationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(organizationUpdatePayload(values, expectedVersion)),
    });
    const value = await body(response);
    if (!response.ok) {
      const error = failure(response, value, "ไม่สามารถบันทึกองค์กรได้");
      return { ok: false, ...error };
    }
    return { ok: true, workspace: value as OrganizationWorkspaceDto };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export function organizationListView(state: { kind: "loading" } | OrganizationListRequest) {
  if (state.kind === "loading") return "loading";
  if (state.kind === "error" && state.status === 401) return "sign-in";
  if (state.kind === "error") return state.status === 403 ? "forbidden" : "retry";
  return state.organizations.length === 0 ? "empty" : "content";
}

export function organizationWorkspaceView(state: { kind: "loading" } | OrganizationWorkspaceRequest) {
  if (state.kind === "loading") return "loading";
  return state.kind === "error" ? (state.status === 403 ? "forbidden" : "retry") : "content";
}

export function organizationMutationView(code?: string) {
  return code === "stale_version" ? "stale" : "idle";
}
