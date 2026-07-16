import { and, eq, like } from "drizzle-orm";

import type { AppDatabase } from "@/platform/database/client";

import { createTransactionAuth } from "./auth";
import type { IdentityConfig } from "./config";
import {
  genericAuthMessage,
  type SignUpCommand,
} from "./contracts";
import { enqueueAuthEmail } from "./email/outbox";
import {
  identityAccounts,
  identityAuditEvents,
  identityPolicyAcceptances,
  identityProfiles,
  identityVerifications,
} from "./schema";

export type IdentityRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type GenericAuthResult = { status: true; message: string };

const genericResult = (): GenericAuthResult => ({
  status: true,
  message: genericAuthMessage,
});

export function createIdentityService(database: AppDatabase, config: IdentityConfig) {
  return {
    signUp: async (
      command: SignUpCommand,
      request: IdentityRequestContext = {},
    ): Promise<GenericAuthResult> => {
      await database.transaction(async (transaction) => {
        const existing = await transaction
          .select({ id: identityAccounts.id })
          .from(identityAccounts)
          .where(eq(identityAccounts.email, command.email));
        const auth = createTransactionAuth(transaction, config, {
          sendVerificationEmail: async ({ user, token }) => {
            const origin = new URL(config.baseUrl).origin;
            const actionUrl = new URL("/api/auth/verify-email", origin);
            actionUrl.searchParams.set("token", token);
            actionUrl.searchParams.set("callbackURL", "/verify-email?verified=1");
            await enqueueAuthEmail(
              transaction,
              config,
              user.id,
              {
                template: "verify_email",
                email: user.email,
                token,
                url: actionUrl.href,
              },
              new Date(Date.now() + 60 * 60 * 1_000),
            );
          },
          sendResetPassword: async () => undefined,
        });
        const result = await auth.api.signUpEmail({
          body: {
            name: command.displayName,
            email: command.email,
            password: command.password,
            ageAttestedAt: command.ageAttestedAt,
            callbackURL: command.callbackPath,
          },
        });
        if (existing.length > 0) return;
        await transaction.insert(identityProfiles).values({
          accountId: result.user.id,
          displayName: command.displayName,
        });
        await transaction.insert(identityPolicyAcceptances).values([
          {
            accountId: result.user.id,
            policyType: "terms",
            policyVersion: command.termsVersion,
            acceptedAt: command.ageAttestedAt,
            ipAddress: request.ipAddress,
            userAgent: request.userAgent,
          },
          {
            accountId: result.user.id,
            policyType: "privacy",
            policyVersion: command.privacyVersion,
            acceptedAt: command.ageAttestedAt,
            ipAddress: request.ipAddress,
            userAgent: request.userAgent,
          },
        ]);
        await transaction.insert(identityAuditEvents).values({
          accountId: result.user.id,
          action: "identity.signup_requested.v1",
          payload: { source: "email_password" },
          occurredAt: command.ageAttestedAt,
        });
      });
      return genericResult();
    },

    verifyEmail: async (token: string): Promise<GenericAuthResult> => {
      await database.transaction(async (transaction) => {
        const auth = createTransactionAuth(transaction, config, {
          sendVerificationEmail: async () => undefined,
          sendResetPassword: async () => undefined,
          afterEmailVerification: async (user) => {
            await transaction
              .update(identityAccounts)
              .set({ status: "active", updatedAt: new Date() })
              .where(
                and(
                  eq(identityAccounts.id, user.id),
                  eq(identityAccounts.status, "pending_verification"),
                ),
              );
            await transaction.insert(identityAuditEvents).values({
              accountId: user.id,
              action: "identity.email_verified.v1",
              payload: { source: "email_link" },
              occurredAt: new Date(),
            });
          },
        });
        await auth.api.verifyEmail({ query: { token } });
      });
      return genericResult();
    },

    signIn: async (
      command: { email: string; password: string; callbackPath: string },
      headers: Headers,
    ): Promise<{ status: number; headers: Headers; body: GenericAuthResult }> => {
      try {
        return await database.transaction(async (transaction) => {
          const rows = await transaction
            .select({ status: identityAccounts.status })
            .from(identityAccounts)
            .where(eq(identityAccounts.email, command.email));
          if (rows[0]?.status !== "active") {
            return { status: 401, headers: new Headers(), body: genericResult() };
          }
          const auth = createTransactionAuth(transaction, config, {
            sendVerificationEmail: async () => undefined,
            sendResetPassword: async () => undefined,
          });
          const result = await auth.api.signInEmail({
            body: {
              email: command.email,
              password: command.password,
              callbackURL: command.callbackPath,
            },
            headers,
            returnHeaders: true,
          });
          return { status: 200, headers: result.headers, body: genericResult() };
        });
      } catch {
        return { status: 401, headers: new Headers(), body: genericResult() };
      }
    },

    signOut: async (headers: Headers) =>
      database.transaction(async (transaction) => {
        const auth = createTransactionAuth(transaction, config, {
          sendVerificationEmail: async () => undefined,
          sendResetPassword: async () => undefined,
        });
        const result = await auth.api.signOut({ headers, returnHeaders: true });
        return { status: 200, headers: result.headers, body: genericResult() };
      }),

    requestPasswordReset: async (
      command: { email: string; redirectPath: string },
      request: IdentityRequestContext = {},
    ): Promise<GenericAuthResult> => {
      await database.transaction(async (transaction) => {
        const rows = await transaction
          .select({ id: identityAccounts.id })
          .from(identityAccounts)
          .where(eq(identityAccounts.email, command.email))
          .for("update");
        const account = rows[0];
        if (account) {
          await transaction
            .delete(identityVerifications)
            .where(
              and(
                eq(identityVerifications.value, account.id),
                like(identityVerifications.identifier, "reset-password:%"),
              ),
            );
        }
        const auth = createTransactionAuth(transaction, config, {
          sendVerificationEmail: async () => undefined,
          sendResetPassword: async ({ user, token }) => {
            const actionUrl = new URL(
              "/reset-password",
              new URL(config.baseUrl).origin,
            );
            actionUrl.searchParams.set("token", token);
            await enqueueAuthEmail(
              transaction,
              config,
              user.id,
              {
                template: "reset_password",
                email: user.email,
                token,
                url: actionUrl.href,
              },
              new Date(Date.now() + 30 * 60 * 1_000),
            );
          },
        });
        await auth.api.requestPasswordReset({
          body: { email: command.email, redirectTo: command.redirectPath },
        });
        if (account) {
          await transaction.insert(identityAuditEvents).values({
            accountId: account.id,
            action: "identity.password_reset_requested.v1",
            payload: {
              source: "email_password",
              requestContext: request.ipAddress ? "network_present" : "network_absent",
            },
            occurredAt: new Date(),
          });
        }
      });
      return genericResult();
    },

    resetPassword: async (command: {
      token: string;
      newPassword: string;
    }): Promise<{ status: number; body: GenericAuthResult }> =>
      database.transaction(async (transaction) => {
        const auth = createTransactionAuth(transaction, config, {
          sendVerificationEmail: async () => undefined,
          sendResetPassword: async () => undefined,
          afterPasswordReset: async (user) => {
            await transaction.insert(identityAuditEvents).values({
              accountId: user.id,
              action: "identity.password_reset_completed.v1",
              payload: { source: "email_password" },
              occurredAt: new Date(),
            });
          },
        });
        const response = await auth.api.resetPassword({
          body: { token: command.token, newPassword: command.newPassword },
          asResponse: true,
        });
        return { status: response.status, body: genericResult() };
      }),
  };
}
