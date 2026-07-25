import { getOAuthState } from "better-auth/api";

import type { AppDatabase } from "@/platform/database/client";
import type { DatabaseTransaction } from "@/platform/database/transaction";

import { appendIdentityAudit } from "./audit";
import { createTransactionAuth } from "./auth";
import type { GoogleAuthConfig } from "./config";
import { identityPolicyAcceptances, identityProfiles } from "./schema";

const inertCallbacks = {
  sendVerificationEmail: async () => undefined,
  sendResetPassword: async () => undefined,
};

function unavailable(): Response {
  return Response.json({ message: "not found" }, { status: 404 });
}

type GoogleUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

type GooglePolicyAcceptance = {
  acceptedAt: Date;
  termsVersion: string;
  privacyVersion: string;
};

function sameOrigin(request: Request, config: GoogleAuthConfig): boolean {
  return request.headers.get("origin") === new URL(config.baseUrl).origin;
}

function isSuccessfulCallback(response: Response, config: GoogleAuthConfig) {
  const location = response.headers.get("location");
  if (!location || response.status < 300 || response.status >= 400) return false;
  const redirect = new URL(location, config.baseUrl);
  return (
    redirect.origin === new URL(config.baseUrl).origin &&
    redirect.pathname === "/"
  );
}

async function readGooglePolicyAcceptance(
  config: GoogleAuthConfig,
): Promise<GooglePolicyAcceptance> {
  const state = await getOAuthState();
  const acceptedAt =
    typeof state?.policyAcceptedAt === "string"
      ? new Date(state.policyAcceptedAt)
      : undefined;
  if (
    !config.currentPolicies ||
    state?.termsVersion !== config.currentPolicies.termsVersion ||
    state?.privacyVersion !== config.currentPolicies.privacyVersion ||
    !acceptedAt ||
    !Number.isFinite(acceptedAt.getTime())
  ) {
    throw new Error("Google onboarding policy state is invalid");
  }
  return {
    acceptedAt,
    termsVersion: config.currentPolicies.termsVersion,
    privacyVersion: config.currentPolicies.privacyVersion,
  };
}

function createGoogleOnboardingCallbacks(
  transaction: DatabaseTransaction,
  config: GoogleAuthConfig,
  request: Request,
) {
  let acceptance: GooglePolicyAcceptance | undefined;
  return {
    beforeGoogleUserCreate: async (
      user: GoogleUser,
    ): Promise<{ status: "active" }> => {
      if (!user.emailVerified || !user.name.trim()) {
        throw new Error("Google profile is incomplete");
      }
      acceptance = await readGooglePolicyAcceptance(config);
      return { status: "active" };
    },
    afterGoogleUserCreate: async (user: GoogleUser): Promise<void> => {
      if (!acceptance) {
        throw new Error("Google onboarding policy state is unavailable");
      }
      await transaction.insert(identityProfiles).values({
        accountId: user.id,
        displayName: user.name.trim(),
      });
      await transaction.insert(identityPolicyAcceptances).values([
        {
          accountId: user.id,
          policyType: "terms",
          policyVersion: acceptance.termsVersion,
          acceptedAt: acceptance.acceptedAt,
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
        {
          accountId: user.id,
          policyType: "privacy",
          policyVersion: acceptance.privacyVersion,
          acceptedAt: acceptance.acceptedAt,
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
      ]);
      await appendIdentityAudit(transaction, {
        targetAccountId: user.id,
        actor: { type: "account", accountId: user.id },
        action: "identity.signup_requested.v1",
        payload: { source: "google_oauth" },
        occurredAt: acceptance.acceptedAt,
      });
      await appendIdentityAudit(transaction, {
        targetAccountId: user.id,
        actor: { type: "account", accountId: user.id },
        action: "identity.email_verified.v1",
        payload: { source: "google_oauth" },
        occurredAt: acceptance.acceptedAt,
      });
    },
  };
}

export function createGoogleLoginHandlers(
  database: AppDatabase,
  config: GoogleAuthConfig,
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
              requestSignUp: true,
              callbackURL: "/",
              errorCallbackURL: "/sign-in/google-error",
              additionalData: config.currentPolicies
                ? {
                    policyAcceptedAt: new Date().toISOString(),
                    termsVersion: config.currentPolicies.termsVersion,
                    privacyVersion: config.currentPolicies.privacyVersion,
                  }
                : undefined,
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
          const onboardingCallbacks = createGoogleOnboardingCallbacks(
            transaction,
            config,
            request,
          );
          const auth = createTransactionAuth(
            transaction,
            config,
            { ...inertCallbacks, ...onboardingCallbacks },
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
