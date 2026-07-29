import { z } from "zod";

import { AuthenticationRequiredError, requireActor, type Actor } from "@/modules/identity";
import { getRuntimeDatabaseConnection } from "@/platform/database/client";

import type {
  CreateOrganizationCommand,
  OrganizationError,
  OrganizationSummaryDto,
  UpdateOrganizationIdentityCommand,
} from "./contracts";
import { createOrganizationService, type OrganizationOperationResult, type OrganizationWorkspaceDto } from "./service";

type OrganizationHttpService = {
  createOrganization(
    actor: Actor,
    command: CreateOrganizationCommand,
  ): Promise<OrganizationOperationResult<unknown>>;
  listOrganizationsForActor(actor: Actor): Promise<OrganizationOperationResult<unknown>>;
  getOrganizationWorkspace(
    actor: Actor,
    organizationId: string,
  ): Promise<OrganizationOperationResult<unknown>>;
  updateOrganizationIdentity(
    actor: Actor,
    command: UpdateOrganizationIdentityCommand,
  ): Promise<OrganizationOperationResult<unknown>>;
};

export type OrganizationListServerState =
  | { kind: "success"; organizations: OrganizationSummaryDto[] }
  | { kind: "error"; message: string; status?: number };

export type OrganizationWorkspaceServerState =
  | { kind: "success"; workspace: OrganizationWorkspaceDto }
  | { kind: "error"; message: string; status?: number };

const createInput = z
  .object({
    displayName: z.string().max(160),
    slug: z.string().max(63),
    description: z.string().max(1000).optional(),
    contactEmail: z.string().max(320),
    locale: z.enum(["th-TH", "en-US"]),
    timeZone: z.string().max(128),
  })
  .strict();

const updateInput = createInput
  .omit({ slug: true })
  .extend({ description: z.string().max(1000).nullable(), expectedVersion: z.number().int().positive() })
  .strict();

const organizationIdInput = z.string().uuid();

type OrganizationHttpDependencies = {
  service: OrganizationHttpService;
  requireActor(request: Request): Promise<Actor>;
  trustedOrigin: string;
};

type ErrorBody = { status: false; message: string; code?: OrganizationError["code"]; fieldErrors?: Record<string, string> };

function errorResponse(
  status: number,
  message: string,
  options: Omit<ErrorBody, "status" | "message"> = {},
) {
  return Response.json({ status: false, message, ...options } satisfies ErrorBody, { status });
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new z.ZodError([]);
  }
  return request.json();
}

function invalidInput(error: unknown): Response {
  const fieldErrors: Record<string, string> = {};
  if (error instanceof z.ZodError) {
    for (const issue of error.issues) {
      fieldErrors[String(issue.path[0] ?? "_form")] ??= "ข้อมูลช่องนี้ไม่ถูกต้อง";
    }
  }
  return errorResponse(400, "ข้อมูลที่ส่งมาไม่ถูกต้อง", { fieldErrors });
}

function resultResponse(result: OrganizationOperationResult<unknown>): Response {
  if (result.ok) return Response.json(result.value);
  const { code, field } = result.error;
  if (code === "invalid_input") {
    return errorResponse(400, "ข้อมูลที่ส่งมาไม่ถูกต้อง", {
      code,
      fieldErrors: field ? { [field]: "ข้อมูลช่องนี้ไม่ถูกต้อง" } : undefined,
    });
  }
  if (code === "slug_taken") {
    return errorResponse(409, "ชื่อ URL นี้ถูกใช้งานแล้ว", {
      code,
      fieldErrors: { slug: "ชื่อ URL นี้ถูกใช้งานแล้ว" },
    });
  }
  if (code === "stale_version") {
    return errorResponse(409, "ข้อมูลถูกแก้ไขจากที่อื่น กรุณาโหลดข้อมูลใหม่", { code });
  }
  if (code === "organization_not_found") {
    return errorResponse(404, "ไม่พบองค์กรที่ต้องการ");
  }
  return errorResponse(403, "ไม่อนุญาตให้ดำเนินการ");
}

function workspaceResponse(result: OrganizationOperationResult<unknown>): Response {
  if (!result.ok) return resultResponse(result);
  const workspace = result.value as OrganizationWorkspaceDto;
  if (workspace.membership.role !== "member") return Response.json(workspace);
  const organization = { ...workspace.organization, contactEmail: undefined };
  return Response.json({ ...workspace, organization });
}

function serverError(result: OrganizationOperationResult<unknown>): { message: string; status: number } {
  if (result.ok) throw new Error("server error mapping requires a failed result");
  if (result.error.code === "organization_not_found") return { message: "ไม่พบองค์กรที่ต้องการ", status: 404 };
  return { message: "ไม่อนุญาตให้ดำเนินการ", status: 403 };
}

type OrganizationServerAuthError = { kind: "error"; message: string; status?: number };

async function runtimeActor(request: Request): Promise<Actor | OrganizationServerAuthError> {
  try {
    return await requireActor(request);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { kind: "error", message: "กรุณาเข้าสู่ระบบหรือยืนยันตัวตนใหม่", status: 401 };
    }
    return { kind: "error", message: "ไม่สามารถโหลดองค์กรได้ในขณะนี้", status: 503 };
  }
}

/**
 * Server-component read composition. Initial organization data deliberately
 * stays on the server; browser fetches are reserved for explicit retry actions.
 */
export async function loadOrganizationListForServer(request: Request): Promise<OrganizationListServerState> {
  const actor = await runtimeActor(request);
  if (!("accountId" in actor)) return actor;
  try {
    const { db } = getRuntimeDatabaseConnection();
    const result = await createOrganizationService(db).listOrganizationsForActor(actor);
    if (!result.ok) return { kind: "error", ...serverError(result) };
    return { kind: "success", organizations: result.value };
  } catch {
    return { kind: "error", message: "ไม่สามารถโหลดองค์กรได้ในขณะนี้", status: 503 };
  }
}

export async function loadOrganizationWorkspaceForServer(
  request: Request,
  organizationId: string,
): Promise<OrganizationWorkspaceServerState> {
  const actor = await runtimeActor(request);
  if (!("accountId" in actor)) return actor;
  try {
    const { db } = getRuntimeDatabaseConnection();
    const result = await createOrganizationService(db).getOrganizationWorkspace(actor, organizationId);
    if (!result.ok) return { kind: "error", ...serverError(result) };
    return { kind: "success", workspace: result.value };
  } catch {
    return { kind: "error", message: "ไม่สามารถโหลดองค์กรได้ในขณะนี้", status: 503 };
  }
}

export function createOrganizationHttpHandlers(dependencies: OrganizationHttpDependencies) {
  const trusted = new URL(dependencies.trustedOrigin).origin;
  const rejectTarget = (request: Request) =>
    new URL(request.url).origin === trusted
      ? undefined
      : errorResponse(403, "ไม่อนุญาตให้ดำเนินการ");
  const rejectMutation = (request: Request) => {
    const target = rejectTarget(request);
    if (target) return target;
    const origin = request.headers.get("origin");
    if (origin === trusted) return undefined;
    if (!origin && request.headers.get("sec-fetch-site") === "same-origin") return undefined;
    return errorResponse(403, "ไม่อนุญาตให้ดำเนินการ");
  };
  const withActor = async (request: Request): Promise<Actor | Response> => {
    try {
      return await dependencies.requireActor(request);
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return errorResponse(401, "กรุณาเข้าสู่ระบบหรือยืนยันตัวตนใหม่");
      }
      return errorResponse(503, "ไม่สามารถโหลดองค์กรได้ในขณะนี้");
    }
  };

  return {
    listOrganizations: async (request: Request) => {
      const target = rejectTarget(request);
      if (target) return target;
      const actor = await withActor(request);
      if (actor instanceof Response) return actor;
      try {
        const result = await dependencies.service.listOrganizationsForActor(actor);
        if (!result.ok) return resultResponse(result);
        return Response.json({ organizations: result.value });
      } catch {
        return errorResponse(500, "ไม่สามารถโหลดองค์กรได้ในขณะนี้");
      }
    },
    createOrganization: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      const actor = await withActor(request);
      if (actor instanceof Response) return actor;
      try {
        const result = await dependencies.service.createOrganization(actor, createInput.parse(await readJson(request)));
        if (!result.ok) return resultResponse(result);
        return Response.json(result.value, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return invalidInput(error);
        return errorResponse(500, "ไม่สามารถสร้างองค์กรได้ในขณะนี้");
      }
    },
    getOrganization: async (request: Request, organizationId: string) => {
      const target = rejectTarget(request);
      if (target) return target;
      const actor = await withActor(request);
      if (actor instanceof Response) return actor;
      try {
        const result = await dependencies.service.getOrganizationWorkspace(actor, organizationIdInput.parse(organizationId));
        return workspaceResponse(result);
      } catch (error) {
        return error instanceof z.ZodError ? invalidInput(error) : errorResponse(500, "ไม่สามารถโหลดองค์กรได้ในขณะนี้");
      }
    },
    updateOrganization: async (request: Request, organizationId: string) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      const actor = await withActor(request);
      if (actor instanceof Response) return actor;
      try {
        const parsed = updateInput.parse(await readJson(request));
        const result = await dependencies.service.updateOrganizationIdentity(actor, {
          ...parsed,
          organizationId: organizationIdInput.parse(organizationId),
        });
        return resultResponse(result);
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return invalidInput(error);
        return errorResponse(500, "ไม่สามารถบันทึกองค์กรได้ในขณะนี้");
      }
    },
  };
}

export function getOrganizationHttpHandlers() {
  const authBaseUrl = process.env.AUTH_BASE_URL;
  if (!authBaseUrl) throw new Error("organization runtime configuration is invalid");
  const { db } = getRuntimeDatabaseConnection();
  return createOrganizationHttpHandlers({
    service: createOrganizationService(db),
    requireActor,
    trustedOrigin: new URL(authBaseUrl).origin,
  });
}
