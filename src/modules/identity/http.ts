import { resolveClientIp } from "@/platform/security/client-ip";

import { assertRelativeCallbackPath, type IdentityConfig } from "./config";
import {
  genericAuthMessage,
  parseResetPasswordCommand,
  parseResetRequestCommand,
  parseSignInCommand,
  parseSignUpCommand,
} from "./contracts";
import type { RateLimitDecision } from "./rate-limit";
import type { createIdentityService } from "./service";

type AuthHttpService = ReturnType<typeof createIdentityService>;

type HandlerDependencies = {
  service: AuthHttpService;
  config: IdentityConfig;
  consumeRateLimit(input: {
    endpoint: string;
    clientIp: string;
    windowSeconds: number;
    max: number;
  }): Promise<RateLimitDecision>;
};

function invalidInput(): Response {
  return Response.json(
    { status: false, message: "ข้อมูลที่ส่งมาไม่ถูกต้อง" },
    { status: 400 },
  );
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new Error("invalid content type");
  }
  return request.json();
}

function contextFrom(request: Request) {
  return {
    ipAddress: resolveClientIp(request.headers),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

export function createAuthHttpHandlers(dependencies: HandlerDependencies) {
  const trustedOrigin = new URL(dependencies.config.baseUrl).origin;
  const rejectForeignOrigin = (request: Request): Response | undefined => {
    const origin = request.headers.get("origin");
    if (!origin || origin === trustedOrigin) return;
    return Response.json(
      { status: false, message: genericAuthMessage },
      { status: 403 },
    );
  };
  const limited = async (
    request: Request,
    endpoint: string,
    windowSeconds: number,
  ): Promise<Response | undefined> => {
    const decision = await dependencies.consumeRateLimit({
      endpoint,
      clientIp: resolveClientIp(request.headers),
      windowSeconds,
      max: 3,
    });
    if (decision.allowed) return;
    return Response.json(
      { status: false, message: genericAuthMessage },
      { status: 429, headers: { "retry-after": String(decision.retryAfter) } },
    );
  };

  return {
    signUp: async (request: Request): Promise<Response> => {
      const foreign = rejectForeignOrigin(request);
      if (foreign) return foreign;
      const rejected = await limited(request, "sign-up", 10);
      if (rejected) return rejected;
      try {
        const command = parseSignUpCommand(await readJson(request), {
          termsVersion: dependencies.config.termsVersion,
          privacyVersion: dependencies.config.privacyVersion,
        });
        return Response.json(await dependencies.service.signUp(command, contextFrom(request)));
      } catch {
        return invalidInput();
      }
    },
    verifyEmail: async (request: Request): Promise<Response> => {
      const requestUrl = new URL(request.url);
      const token = requestUrl.searchParams.get("token");
      if (!token) return invalidInput();
      try {
        const result = await dependencies.service.verifyEmail(token);
        const callback = requestUrl.searchParams.get("callbackURL");
        if (callback) {
          const path = assertRelativeCallbackPath(callback);
          return Response.redirect(new URL(path, requestUrl.origin), 302);
        }
        return Response.json(result);
      } catch {
        return Response.json({ status: false, message: genericAuthMessage }, { status: 400 });
      }
    },
    signIn: async (request: Request): Promise<Response> => {
      const foreign = rejectForeignOrigin(request);
      if (foreign) return foreign;
      const rejected = await limited(request, "sign-in", 10);
      if (rejected) return rejected;
      try {
        const result = await dependencies.service.signIn(
          parseSignInCommand(await readJson(request)),
          request.headers,
        );
        return Response.json(result.body, { status: result.status, headers: result.headers });
      } catch {
        return invalidInput();
      }
    },
    forgotPassword: async (request: Request): Promise<Response> => {
      const foreign = rejectForeignOrigin(request);
      if (foreign) return foreign;
      const rejected = await limited(request, "forgot-password", 60);
      if (rejected) return rejected;
      try {
        const command = parseResetRequestCommand(await readJson(request));
        return Response.json(
          await dependencies.service.requestPasswordReset(command, contextFrom(request)),
        );
      } catch {
        return invalidInput();
      }
    },
    resetPassword: async (request: Request): Promise<Response> => {
      const foreign = rejectForeignOrigin(request);
      if (foreign) return foreign;
      try {
        const result = await dependencies.service.resetPassword(
          parseResetPasswordCommand(await readJson(request)),
        );
        return Response.json(result.body, { status: result.status });
      } catch {
        return Response.json({ status: false, message: genericAuthMessage }, { status: 400 });
      }
    },
    signOut: async (request: Request): Promise<Response> => {
      const foreign = rejectForeignOrigin(request);
      if (foreign) return foreign;
      try {
        const result = await dependencies.service.signOut(request.headers);
        return Response.json(result.body, { status: result.status, headers: result.headers });
      } catch {
        return Response.json({ status: false, message: genericAuthMessage }, { status: 401 });
      }
    },
  };
}
