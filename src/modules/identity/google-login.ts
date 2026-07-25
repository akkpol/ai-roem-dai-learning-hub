import type { AppDatabase } from "@/platform/database/client";

import { createTransactionAuth } from "./auth";
import type { IdentityConfig } from "./config";

const inertCallbacks = {
  sendVerificationEmail: async () => undefined,
  sendResetPassword: async () => undefined,
};

function unavailable(): Response {
  return Response.json({ message: "not found" }, { status: 404 });
}

function sameOrigin(request: Request, config: IdentityConfig): boolean {
  return request.headers.get("origin") === new URL(config.baseUrl).origin;
}

function isSuccessfulCallback(response: Response, config: IdentityConfig) {
  const location = response.headers.get("location");
  if (!location || response.status < 300 || response.status >= 400) return false;
  const redirect = new URL(location, config.baseUrl);
  return (
    redirect.origin === new URL(config.baseUrl).origin &&
    redirect.pathname === "/"
  );
}

export function createGoogleLoginHandlers(
  database: AppDatabase,
  config: IdentityConfig,
) {
  return {
    start: async (request: Request): Promise<Response> => {
      if (!config.googleOAuth) return unavailable();
      if (!sameOrigin(request, config)) {
        return Response.json({ message: "forbidden" }, { status: 403 });
      }

      try {
        return await database.transaction(async (transaction) => {
          const auth = createTransactionAuth(
            transaction,
            config,
            inertCallbacks,
          );
          return await auth.api.signInSocial({
            body: {
              provider: "google",
              callbackURL: "/",
              errorCallbackURL: "/sign-in/google-error",
            },
            headers: request.headers,
            asResponse: true,
          });
        });
      } catch {
        return Response.redirect(
          new URL("/sign-in/google-error", new URL(config.baseUrl).origin),
          303,
        );
      }
    },

    callback: async (request: Request): Promise<Response> => {
      if (!config.googleOAuth) return unavailable();
      if (new URL(request.url).pathname !== "/api/auth/callback/google") {
        return unavailable();
      }
      try {
        return await database.transaction(async (transaction) => {
          const auth = createTransactionAuth(
            transaction,
            config,
            inertCallbacks,
            { googleOAuthCallback: true },
          );
          const response = await auth.handler(request);
          if (!isSuccessfulCallback(response, config)) {
            throw new Error("Google OAuth callback was denied");
          }
          return response;
        });
      } catch {
        return Response.redirect(
          new URL("/sign-in/google-error", new URL(config.baseUrl).origin),
          303,
        );
      }
    },
  };
}
