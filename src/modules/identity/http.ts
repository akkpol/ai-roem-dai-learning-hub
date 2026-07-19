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

export function createAuthHttpHandlers(dependencies: HandlerDependencies) {
  const trustedOrigin = new URL(dependencies.config.baseUrl).origin;
  const trustedHost = new URL(dependencies.config.baseUrl).host;
  const forbidden = () =>
    Response.json(
      { status: false, message: genericAuthMessage },
      { status: 403 },
    );
  const rejectUntrustedTarget = (request: Request): Response | undefined => {
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host");
    if (
      requestUrl.origin !== trustedOrigin ||
      (host !== null && host.toLowerCase() !== trustedHost.toLowerCase())
    ) {
      return forbidden();
    }
  };
  const rejectUnsafeBrowserRequest = (request: Request): Response | undefined => {
    const untrustedTarget = rejectUntrustedTarget(request);
    if (untrustedTarget) return untrustedTarget;
    const origin = request.headers.get("origin");
    if (origin === trustedOrigin) return;
    if (!origin && request.headers.get("sec-fetch-site") === "same-origin") return;
    return forbidden();
  };
  const requestContext = (request: Request) => ({
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  const limited = async (
    request: Request,
    endpoint: string,
    windowSeconds: number,
  ): Promise<Response | undefined> => {
    const decision = await dependencies.consumeRateLimit({
      endpoint,
      clientIp: resolveClientIp(
        request.headers,
        dependencies.config.trustedProxy,
      ),
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
      const foreign = rejectUnsafeBrowserRequest(request);
      if (foreign) return foreign;
      const rejected = await limited(request, "sign-up", 60);
      if (rejected) return rejected;
      let command;
      try {
        command = parseSignUpCommand(await readJson(request), {
          termsVersion: dependencies.config.termsVersion,
          privacyVersion: dependencies.config.privacyVersion,
        });
      } catch {
        return invalidInput();
      }
      try {
        return Response.json(
          await dependencies.service.signUp(command, requestContext(request)),
        );
      } catch {
        return Response.json(
          { status: false, message: genericAuthMessage },
          { status: 500 },
        );
      }
    },
    verifyEmail: async (request: Request): Promise<Response> => {
      const untrustedTarget = rejectUntrustedTarget(request);
      if (untrustedTarget) return untrustedTarget;
      const requestUrl = new URL(request.url);
      const token = requestUrl.searchParams.get("token");
      if (!token) return invalidInput();
      try {
        const result = await dependencies.service.verifyEmail(token);
        const callback = requestUrl.searchParams.get("callbackURL");
        if (callback) {
          const path = assertRelativeCallbackPath(callback);
          return Response.redirect(new URL(path, trustedOrigin), 302);
        }
        return Response.json(result);
      } catch {
        return Response.json({ status: false, message: genericAuthMessage }, { status: 400 });
      }
    },
    signIn: async (request: Request): Promise<Response> => {
      const foreign = rejectUnsafeBrowserRequest(request);
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
      const foreign = rejectUnsafeBrowserRequest(request);
      if (foreign) return foreign;
      const rejected = await limited(request, "forgot-password", 60);
      if (rejected) return rejected;
      try {
        const command = parseResetRequestCommand(await readJson(request));
        return Response.json(
          await dependencies.service.requestPasswordReset(command, requestContext(request)),
        );
      } catch {
        return invalidInput();
      }
    },
    resetPassword: async (request: Request): Promise<Response> => {
      const foreign = rejectUnsafeBrowserRequest(request);
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
      const foreign = rejectUnsafeBrowserRequest(request);
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
