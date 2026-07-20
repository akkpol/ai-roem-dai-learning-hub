import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

import type { DatabaseTransaction } from "@/platform/database/transaction";

import type { IdentityConfig } from "./config";
import { betterAuthSchema } from "./schema";

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
};

export function createTransactionAuth(
  transaction: DatabaseTransaction,
  config: IdentityConfig,
  callbacks: TransactionAuthCallbacks,
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
    user: {
      additionalFields: {
        status: {
          type: "string",
          required: true,
          defaultValue: "pending_verification",
          input: false,
        },
        ageAttestedAt: { type: "date", required: true },
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
