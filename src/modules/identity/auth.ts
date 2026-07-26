import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

import type { DatabaseTransaction } from "@/platform/database/transaction";

import type { CoreAuthConfig } from "./config";
import { betterAuthSchema, identityAccounts } from "./schema";

export type TransactionAuthCallbacks = {
  sendVerificationEmail(input: {
    user: { id: string; email: string };
    url: string;
    token: string;
  }): Promise<void>;
  sendResetPassword(input: {
    user: { id: string; email: string };
    url: string;
    token: string;
  }): Promise<void>;
  afterEmailVerification?(user: { id: string }): Promise<void>;
  afterPasswordReset?(user: { id: string }): Promise<void>;
  beforeGoogleUserCreate?(user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  }): Promise<{ status: "active" }>;
  afterGoogleUserCreate?(user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  }): Promise<void>;
  beforeGoogleSessionCreate?(userId: string): Promise<void>;
};

export type TransactionAuthOptions = {
  googleOAuthCallback?: boolean;
  allowDeletionCancellation?: boolean;
};

export function createTransactionAuth(
  transaction: DatabaseTransaction,
  config: CoreAuthConfig,
  callbacks: TransactionAuthCallbacks,
  options: TransactionAuthOptions = {},
) {
  return betterAuth({
    appName: "Learning Hub",
    baseURL: config.baseUrl,
    secret: config.authSecret,
    trustedOrigins: [new URL(config.baseUrl).origin],
    database: drizzleAdapter(transaction, {
      provider: "pg",
      schema: betterAuthSchema,
      transaction: false,
    }),
    logger: { disabled: true },
    socialProviders: config.googleOAuth
      ? {
          google: {
            clientId: config.googleOAuth.clientId,
            clientSecret: config.googleOAuth.clientSecret,
            disableSignUp: false,
            prompt: "select_account",
          },
        }
      : {},
    account: {
      encryptOAuthTokens: true,
    },
    databaseHooks: {
      user: options.googleOAuthCallback
        ? {
            create: {
              before: async (user) => {
                if (!callbacks.beforeGoogleUserCreate) return false;
                return {
                  data: await callbacks.beforeGoogleUserCreate(user),
                };
              },
              after: async (user) => {
                if (!callbacks.afterGoogleUserCreate) {
                  throw new Error("Google onboarding callback is unavailable");
                }
                await callbacks.afterGoogleUserCreate(user);
              },
            },
          }
        : undefined,
      session: {
        create: {
          before: async (session) => {
            const account = await transaction
              .select({
                status: identityAccounts.status,
                twoFactorEnabled: identityAccounts.twoFactorEnabled,
              })
              .from(identityAccounts)
              .where(eq(identityAccounts.id, session.userId));
            const sessionAllowed =
              (account[0]?.status === "active" ||
                (options.allowDeletionCancellation === true &&
                  account[0]?.status === "deletion_scheduled")) &&
              (!options.googleOAuthCallback ||
                account[0]?.twoFactorEnabled === false);
            if (!sessionAllowed) return false;
            if (options.googleOAuthCallback) {
              if (!callbacks.beforeGoogleSessionCreate) {
                throw new Error(
                  "Google policy acceptance callback is unavailable",
                );
              }
              await callbacks.beforeGoogleSessionCreate(session.userId);
            }
            return true;
          },
        },
      },
    },
    user: {
      additionalFields: {
        status: {
          type: "string",
          required: true,
          defaultValue: "pending_verification",
          input: false,
        },
      },
      deleteUser: { enabled: false },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      freshAge: 10 * 60,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url, token }) =>
        callbacks.sendVerificationEmail({ user, url, token }),
      afterEmailVerification: async (user) =>
        callbacks.afterEmailVerification?.(user),
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) =>
        callbacks.sendResetPassword({ user, url, token }),
      onPasswordReset: async ({ user }) => callbacks.afterPasswordReset?.(user),
    },
    rateLimit: { enabled: true, storage: "database" },
    plugins: [
      twoFactor({
        issuer: "Learning Hub",
        twoFactorTable: "twoFactor",
      }),
    ],
    advanced: { database: { generateId: "uuid" } },
  });
}
