import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  createIdentityAdministrationService,
} from "./administration";
import type { Actor } from "./authorization";
import { globalRoleValues } from "./schema";

const accountId = z.string().uuid();
const reasonCode = z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/);
const role = z.enum(globalRoleValues);

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke_sessions"), reasonCode }),
  z.object({ action: z.literal("suspend"), reasonCode }),
  z.object({ action: z.literal("reactivate"), reasonCode }),
  z.object({
    action: z.literal("grant_role"),
    reasonCode,
    role,
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    action: z.literal("revoke_role"),
    reasonCode,
    role,
  }),
]);

export type IdentityAdministrationPort = ReturnType<
  typeof createIdentityAdministrationService
>;

export type ExactAccountLookup =
  | { kind: "account_id"; value: string }
  | { kind: "email"; value: string };

export function parseExactAccountLookup(value: string): ExactAccountLookup {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return { kind: "account_id", value: value.toLowerCase() };
  }
  if (
    value === value.toLowerCase() &&
    value === value.trim() &&
    value.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    return { kind: "email", value };
  }
  throw new Error("exact account lookup is invalid");
}

function correlationId(request: Request): string {
  const supplied = request.headers.get("x-correlation-id");
  return supplied && /^[A-Za-z0-9_.:-]{1,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("invalid") ||
    message.includes("exact account lookup")
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (
    message.includes("permission denied") ||
    message.includes("authentication required")
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (message.includes("unavailable")) {
    return Response.json({ error: "account_not_found" }, { status: 404 });
  }
  if (
    message.includes("not active") ||
    message.includes("not suspended") ||
    message.includes("already") ||
    message.includes("requires") ||
    message.includes("eligible")
  ) {
    return Response.json({ error: "action_conflict" }, { status: 409 });
  }
  return Response.json({ error: "identity_operation_failed" }, { status: 503 });
}

function capabilities(actor: Actor, targetAccountId?: string) {
  const isAdmin = actor.globalRoles.includes("platform_admin");
  const isSupport = actor.globalRoles.includes("support_operator");
  return {
    canManageLifecycle: isAdmin,
    canManageRoles: isAdmin,
    canRevokeSessions: isSupport,
    selfMutationForbidden: targetAccountId === actor.accountId,
  };
}

export function createIdentityAdminHttpHandlers(input: {
  authenticate(request: Request): Promise<Actor | null>;
  administration: IdentityAdministrationPort;
  trustedOrigin: string;
}) {
  const trusted = new URL(input.trustedOrigin);
  const rejectTarget = (request: Request): Response | undefined => {
    const target = new URL(request.url);
    const host = request.headers.get("host");
    if (
      target.origin !== trusted.origin ||
      (host && host.toLowerCase() !== trusted.host.toLowerCase())
    ) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  };
  const rejectMutation = (request: Request): Response | undefined => {
    const target = rejectTarget(request);
    if (target) return target;
    const origin = request.headers.get("origin");
    if (origin === trusted.origin) return;
    if (!origin && request.headers.get("sec-fetch-site") === "same-origin") {
      return;
    }
    return Response.json({ error: "forbidden" }, { status: 403 });
  };
  const authenticate = async (request: Request) => {
    const actor = await input.authenticate(request);
    if (!actor || actor.accountStatus !== "active" || !actor.emailVerified) {
      return null;
    }
    return actor;
  };

  return {
    searchAccounts: async (request: Request): Promise<Response> => {
      const target = rejectTarget(request);
      if (target) return target;
      const actor = await authenticate(request);
      if (!actor) {
        return Response.json(
          { error: "authentication_required" },
          { status: 401 },
        );
      }
      if (!actor.globalRoles.includes("platform_admin")) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      try {
        const query = new URL(request.url).searchParams.get("query") ?? "";
        const lookup = parseExactAccountLookup(query);
        const accounts = await input.administration.searchAccounts(
          actor,
          lookup.value,
          1,
        );
        return Response.json({ accounts });
      } catch (error) {
        return errorResponse(error);
      }
    },

    getAccount: async (
      request: Request,
      targetAccountId: string,
    ): Promise<Response> => {
      const requestTarget = rejectTarget(request);
      if (requestTarget) return requestTarget;
      const actor = await authenticate(request);
      if (!actor) {
        return Response.json(
          { error: "authentication_required" },
          { status: 401 },
        );
      }
      try {
        const target = accountId.parse(targetAccountId);
        if (actor.globalRoles.includes("platform_admin")) {
          const [account, audit] = await Promise.all([
            input.administration.getAdminAccount(actor, target),
            input.administration.getAccountAudit(actor, target, 50),
          ]);
          return Response.json({
            account,
            audit,
            capabilities: capabilities(actor, target),
          });
        }
        if (actor.globalRoles.includes("support_operator")) {
          const account = await input.administration.getSupportAccount(
            actor,
            target,
          );
          return Response.json({
            account,
            audit: [],
            capabilities: capabilities(actor, target),
          });
        }
        return Response.json({ error: "forbidden" }, { status: 403 });
      } catch (error) {
        return errorResponse(error);
      }
    },

    mutateAccount: async (
      request: Request,
      targetAccountId: string,
    ): Promise<Response> => {
      const unsafe = rejectMutation(request);
      if (unsafe) return unsafe;
      const actor = await authenticate(request);
      if (!actor) {
        return Response.json(
          { error: "authentication_required" },
          { status: 401 },
        );
      }
      try {
        const target = accountId.parse(targetAccountId);
        const command = action.parse(await request.json());
        const base = {
          actor,
          targetAccountId: target,
          reasonCode: command.reasonCode,
          correlationId: correlationId(request),
        };
        let result: Record<string, unknown>;
        if (command.action === "revoke_sessions") {
          result = await input.administration.revokeAccountSessions(base);
        } else if (command.action === "suspend") {
          result = await input.administration.suspendAccount(base);
        } else if (command.action === "reactivate") {
          result = await input.administration.reactivateAccount(base);
        } else if (command.action === "grant_role") {
          result = await input.administration.grantGlobalRole({
            ...base,
            role: command.role,
            expiresAt: command.expiresAt
              ? new Date(command.expiresAt)
              : undefined,
          });
        } else {
          result = await input.administration.revokeGlobalRole({
            ...base,
            role: command.role,
          });
        }
        return Response.json({ result });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
