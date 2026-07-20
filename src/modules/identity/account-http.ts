import { z } from "zod";

import {
  AccountInputError,
  parsePasswordChange,
  parseProfileUpdate,
  parseSecondFactorProof,
} from "./account-contracts";
import type { IdentityConfig } from "./config";
import type { createAccountSecurityService } from "./account-security";
import type { createIdentityPrivacyService } from "./privacy";

type AccountService = ReturnType<typeof createAccountSecurityService>;
type PrivacyService = ReturnType<typeof createIdentityPrivacyService>;

function jsonError(status: number, message: string, fieldErrors?: Record<string, string>) {
  return Response.json({ status: false, message, ...(fieldErrors ? { fieldErrors } : {}) }, { status });
}

function invalidInputResponse(error: unknown) {
  if (error instanceof AccountInputError) {
    return jsonError(400, "ข้อมูลที่ส่งมาไม่ถูกต้อง", error.fieldErrors);
  }
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      fieldErrors[String(issue.path[0] ?? "_form")] ??= "ข้อมูลช่องนี้ไม่ถูกต้อง";
    }
    return jsonError(400, "ข้อมูลที่ส่งมาไม่ถูกต้อง", fieldErrors);
  }
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new AccountInputError("invalid content type", { _form: "กรุณาส่งข้อมูล JSON" });
  }
  try {
    return await request.json();
  } catch {
    throw new AccountInputError("invalid JSON", { _form: "ข้อมูล JSON ไม่ถูกต้อง" });
  }
}

function streamJson(value: unknown): Response {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  let offset = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= encoded.length) {
          controller.close();
          return;
        }
        const end = Math.min(offset + 16_384, encoded.length);
        controller.enqueue(encoded.slice(offset, end));
        offset = end;
      },
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": "attachment; filename=learning-hub-identity.json",
        "cache-control": "no-store",
      },
    },
  );
}

function deletionConfirmationPage(request: Request): Response {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token || token.length > 512) {
    return new Response("ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const action = `${url.pathname}?token=${encodeURIComponent(token)}`;
  const html = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ยืนยันการลบบัญชี</title><body><main><h1>ยืนยันการลบบัญชี</h1><p>การเปิดลิงก์นี้ยังไม่เปลี่ยนแปลงบัญชี กดปุ่มด้านล่างเมื่อคุณต้องการเริ่มช่วงรอ 7 วันและออกจากระบบทุกอุปกรณ์</p><form method="post" action="${action}"><button type="submit">ยืนยันและเริ่มช่วงรอ 7 วัน</button></form></main></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; form-action 'self'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

export function optionalSecondFactorProof(input: {
  totpCode?: string;
  recoveryCode?: string;
}) {
  if (!input.totpCode && !input.recoveryCode) return undefined;
  return parseSecondFactorProof({
    totpCode: input.totpCode,
    recoveryCode: input.recoveryCode,
  });
}

export function createAccountHttpHandlers(dependencies: {
  account: AccountService;
  privacy: PrivacyService;
  config: IdentityConfig;
}) {
  const trusted = new URL(dependencies.config.baseUrl);
  const rejectTarget = (request: Request) => {
    const url = new URL(request.url);
    const host = request.headers.get("host");
    if (
      url.origin !== trusted.origin ||
      (host && host.toLowerCase() !== trusted.host.toLowerCase())
    ) {
      return jsonError(403, "ไม่อนุญาตให้ดำเนินการ");
    }
  };
  const rejectMutation = (request: Request) => {
    const target = rejectTarget(request);
    if (target) return target;
    const origin = request.headers.get("origin");
    if (origin === trusted.origin) return;
    if (!origin && request.headers.get("sec-fetch-site") === "same-origin") return;
    return jsonError(403, "ไม่อนุญาตให้ดำเนินการ");
  };
  const guarded = async (work: () => Promise<Response>) => {
    try {
      return await work();
    } catch (error) {
      return invalidInputResponse(error) ?? jsonError(401, "กรุณาเข้าสู่ระบบหรือยืนยันตัวตนใหม่");
    }
  };

  return {
    getProfile: (request: Request) =>
      guarded(async () => Response.json(await dependencies.account.getOwnProfile(request.headers))),
    updateProfile: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () =>
        Response.json(
          await dependencies.account.updateOwnProfile(
            request.headers,
            parseProfileUpdate(await readJson(request)),
          ),
        ),
      );
    },
    listPolicies: (request: Request) =>
      guarded(async () => Response.json(await dependencies.account.listPolicyHistory(request.headers))),
    listSessions: (request: Request) =>
      guarded(async () => Response.json(await dependencies.account.listDeviceSessions(request.headers))),
    revokeSession: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z.object({ sessionId: z.string().uuid() }).strict().parse(await readJson(request));
        return Response.json(
          await dependencies.account.revokeDeviceSession(request.headers, input.sessionId),
        );
      });
    },
    revokeOtherSessions: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => Response.json(await dependencies.account.revokeOtherSessions(request.headers)));
    },
    changePassword: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const result = await dependencies.account.changePassword(
          request.headers,
          parsePasswordChange(await readJson(request)),
        );
        return Response.json({ status: true }, { headers: result.headers });
      });
    },
    beginTwoFactor: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z.object({ password: z.string().min(1).max(128) }).strict().parse(await readJson(request));
        return Response.json(await dependencies.account.beginTwoFactorEnrollment(request.headers, input.password));
      });
    },
    confirmTwoFactor: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z.object({ code: z.string().regex(/^\d{6}$/) }).strict().parse(await readJson(request));
        const result = await dependencies.account.confirmTwoFactorEnrollment(request.headers, input.code);
        return Response.json(result.data, { headers: result.headers });
      });
    },
    regenerateRecoveryCodes: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z.object({ password: z.string().min(1).max(128) }).strict().parse(await readJson(request));
        return Response.json(await dependencies.account.regenerateRecoveryCodes(request.headers, input.password));
      });
    },
    disableTwoFactor: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z
          .object({
            password: z.string().min(1).max(128),
            totpCode: z.string().optional(),
            recoveryCode: z.string().optional(),
          })
          .strict()
          .parse(await readJson(request));
        const proof = optionalSecondFactorProof(input);
        if (!proof) return jsonError(400, "กรุณากรอกรหัสยืนยันตัวตน", {
          totpCode: "กรุณากรอกรหัส TOTP หรือรหัสกู้คืน",
          recoveryCode: "กรุณากรอกรหัส TOTP หรือรหัสกู้คืน",
        });
        return Response.json(
          await dependencies.account.disableTwoFactor(
            request.headers,
            input.password,
            proof,
          ),
        );
      });
    },
    verifySignInSecondFactor: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const result = await dependencies.account.verifySignInSecondFactor(
          request.headers,
          parseSecondFactorProof(await readJson(request)),
        );
        return Response.json(
          { status: true },
          { status: 200, headers: result.headers },
        );
      });
    },
    exportIdentity: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z
          .object({ totpCode: z.string().optional(), recoveryCode: z.string().optional() })
          .strict()
          .parse(await readJson(request));
        const proof = optionalSecondFactorProof(input);
        return streamJson(await dependencies.privacy.exportOwnIdentity(request.headers, proof));
      });
    },
    requestDeletion: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z
          .object({
            password: z.string().min(1).max(128),
            totpCode: z.string().optional(),
            recoveryCode: z.string().optional(),
          })
          .strict()
          .parse(await readJson(request));
        const proof = optionalSecondFactorProof(input);
        return Response.json(
          await dependencies.privacy.requestDeletion(request.headers, input.password, proof),
        );
      });
    },
    renderDeletionConfirmation: (request: Request) => {
      const rejected = rejectTarget(request);
      return rejected ?? deletionConfirmationPage(request);
    },
    confirmDeletion: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token || token.length > 512) return jsonError(400, "ลิงก์ไม่ถูกต้องหรือหมดอายุ");
        return Response.json(await dependencies.privacy.confirmDeletion(token));
      });
    },
    cancelDeletion: async (request: Request) => {
      const rejected = rejectMutation(request);
      if (rejected) return rejected;
      return guarded(async () => {
        const input = z
          .object({
            email: z.string().email().transform((value) => value.trim().toLowerCase()),
            password: z.string().min(1).max(128),
            totpCode: z.string().optional(),
            recoveryCode: z.string().optional(),
          })
          .strict()
          .parse(await readJson(request));
        const proof = optionalSecondFactorProof(input);
        const result = await dependencies.privacy.cancelDeletion(request.headers, {
          email: input.email,
          password: input.password,
          proof,
        });
        return Response.json({ status: true }, { headers: result.headers });
      });
    },
  };
}
