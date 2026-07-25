import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import * as spikeSchema from "./session-003-spike-schema";
import {
  identityAuditEvents,
  identityAccounts,
  identityEmailOutbox,
  identityPolicyAcceptances,
  identityProfiles,
  identityVerifications,
  session003SpikeDdl,
  session003SpikeSchema,
} from "./session-003-spike-schema";

const publicEntryPoints = [
  "sign-up",
  "verify-email",
  "sign-in",
  "forgot-password",
  "reset-password",
  "sign-out",
] as const;

type SpikeDatabase = NodePgDatabase<typeof spikeSchema>;

type SignupRowCounts = {
  accounts: number;
  authFactors: number;
  profiles: number;
  policyAcceptances: number;
  signupAudits: number;
  emailOutbox: number;
};

type ResetRowCounts = {
  verifications: number;
  emailOutbox: number;
  resetAudits: number;
};

type ForceRollback = { forceRollback?: boolean };

type ResetRequestOptions = ForceRollback & {
  afterAccountLocked?: () => Promise<void>;
  forceFailureAt?: "after-invalidation" | "after-outbox";
};

type PublicResetRequestOptions = { ipAddress: string };

export type Session003Spike = {
  database: SpikeDatabase;
  publicEntryPoints: typeof publicEntryPoints;
  rawBetterAuthHandlerExposed: false;
  prepare(): Promise<void>;
  close(): Promise<void>;
  signUp(
    email: string,
    options?: ForceRollback,
  ): Promise<{ verificationCallbackCompleted: boolean }>;
  requestPasswordReset(
    email: string,
    options?: ResetRequestOptions,
  ): Promise<{
    resetCallbackCompleted: boolean;
    plaintextToken: string;
    persistedPayload: string;
  }>;
  resetPassword(token: string): Promise<number>;
  seedVerificationRows(email: string, identifiers: string[]): Promise<void>;
  listVerificationIdentifiers(email: string): Promise<string[]>;
  publicRequestPasswordReset(
    email: string,
    options: PublicResetRequestOptions,
  ): Promise<Response>;
  countSignupRows(email: string): Promise<SignupRowCounts>;
  countResetRows(email: string): Promise<ResetRowCounts>;
};

function requireSpikeDatabaseUrl(
  input: Record<string, string | undefined>,
): string {
  const value = input.SESSION_003_SPIKE_DATABASE_URL;
  if (!value) throw new Error("SESSION_003_SPIKE_DATABASE_URL is required");
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error("SESSION_003_SPIKE_DATABASE_URL must use PostgreSQL");
  }
  if (!parsed.pathname.slice(1).endsWith("_test")) {
    throw new Error("SESSION_003 spike database must end in _test");
  }
  if (!parsed.searchParams.has("sslmode")) {
    throw new Error("SESSION_003 spike database must enforce TLS");
  }
  return value;
}

function hashRecipient(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

function encryptPayload(payload: object, secret: string): string {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function toNumber(value: string): number {
  return Number.parseInt(value, 10);
}

export function createSession003Spike(
  input: Record<string, string | undefined>,
): Session003Spike {
  const url = requireSpikeDatabaseUrl(input);
  const authSecret = "session-003-spike-auth-secret-32-bytes-minimum";
  const outboxSecret = "session-003-spike-outbox-encryption-key";
  const pool = new Pool({ connectionString: url, max: 2 });
  const database = drizzle({ client: pool, schema: spikeSchema });
  const rateLimitAttempts = new Map<
    string,
    { count: number; windowStartedAt: number }
  >();

  async function countSignupRows(email: string): Promise<SignupRowCounts> {
    const recipientHash = hashRecipient(email, outboxSecret);
    const result = await pool.query<{
      accounts: string;
      auth_factors: string;
      profiles: string;
      policy_acceptances: string;
      signup_audits: string;
      email_outbox: string;
    }>(`
      select
        count(distinct a.id) as accounts,
        count(distinct f.id) as auth_factors,
        count(distinct p.account_id) as profiles,
        count(distinct pa.id) as policy_acceptances,
        count(distinct ae.id) as signup_audits,
        count(distinct eo.id) as email_outbox
      from (select $1::text as email) input
      left join identity_accounts a on a.email = input.email
      left join identity_auth_factors f on f.user_id = a.id
      left join identity_profiles p on p.account_id = a.id
      left join identity_policy_acceptances pa on pa.account_id = a.id
      left join identity_audit_events ae
        on ae.account_id = a.id and ae.action = 'identity.signup_requested.v1'
      left join identity_email_outbox eo
        on eo.recipient_hash = $2 and eo.template = 'verify_email'
    `, [email.toLowerCase(), recipientHash]);
    const row = result.rows[0];
    if (!row) throw new Error("SESSION-003 signup count query returned no row");
    return {
      accounts: toNumber(row.accounts),
      authFactors: toNumber(row.auth_factors),
      profiles: toNumber(row.profiles),
      policyAcceptances: toNumber(row.policy_acceptances),
      signupAudits: toNumber(row.signup_audits),
      emailOutbox: toNumber(row.email_outbox),
    };
  }

  async function countResetRows(email: string): Promise<ResetRowCounts> {
    const recipientHash = hashRecipient(email, outboxSecret);
    const result = await pool.query<{
      verifications: string;
      email_outbox: string;
      reset_audits: string;
    }>(`
      select
        count(distinct v.id) as verifications,
        count(distinct eo.id) as email_outbox,
        count(distinct ae.id) as reset_audits
      from (select $1::text as email) input
      left join identity_accounts a on a.email = input.email
      left join identity_verifications v
        on v.value = a.id::text and v.identifier like 'reset-password:%'
      left join identity_email_outbox eo
        on eo.recipient_hash = $2 and eo.template = 'reset_password'
      left join identity_audit_events ae
        on ae.account_id = a.id and ae.action = 'identity.password_reset_requested.v1'
    `, [email.toLowerCase(), recipientHash]);
    const row = result.rows[0];
    if (!row) throw new Error("SESSION-003 reset count query returned no row");
    return {
      verifications: toNumber(row.verifications),
      emailOutbox: toNumber(row.email_outbox),
      resetAudits: toNumber(row.reset_audits),
    };
  }

  function createResetAuth(
    adapterDatabase: SpikeDatabase,
    sendResetPassword: (input: {
      user: { id: string; email: string };
      url: string;
      token: string;
    }) => Promise<void>,
  ) {
    return betterAuth({
      appName: "Learning Hub",
      baseURL: "http://localhost:3000/api/auth",
      secret: authSecret,
      database: drizzleAdapter(adapterDatabase, {
        provider: "pg",
        schema: session003SpikeSchema,
        transaction: false,
      }),
      emailAndPassword: {
        enabled: true,
        resetPasswordTokenExpiresIn: 30 * 60,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword,
      },
      advanced: { database: { generateId: "uuid" } },
    });
  }

  async function findAccountId(email: string): Promise<string | undefined> {
    const rows = await database
      .select({ id: identityAccounts.id })
      .from(identityAccounts)
      .where(eq(identityAccounts.email, email.toLowerCase()));
    return rows[0]?.id;
  }

  return {
    database,
    publicEntryPoints,
    rawBetterAuthHandlerExposed: false,
    prepare: async () => {
      await database.execute(session003SpikeDdl);
    },
    close: () => pool.end(),
    signUp: async (email, options = {}) => {
      let verificationCallbackCompleted = false;
      await database.transaction(async (transaction) => {
        const auth = betterAuth({
          appName: "Learning Hub",
          baseURL: "http://localhost:3000/api/auth",
          secret: authSecret,
          database: drizzleAdapter(transaction, {
            provider: "pg",
            schema: session003SpikeSchema,
            transaction: false,
          }),
          user: {
            additionalFields: {
              status: {
                type: "string",
                required: true,
                defaultValue: "pending_verification",
                input: false,
              },
            },
          },
          emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: false,
            sendVerificationEmail: async ({ user, url: verifyUrl, token }) => {
              const encryptedPayload = encryptPayload(
                { email: user.email, token, url: verifyUrl },
                outboxSecret,
              );
              await transaction.insert(identityEmailOutbox).values({
                accountId: user.id,
                template: "verify_email",
                recipientHash: hashRecipient(user.email, outboxSecret),
                encryptedPayload,
                keyVersion: "spike-v1",
              });
              verificationCallbackCompleted = true;
            },
          },
          emailAndPassword: {
            enabled: true,
            autoSignIn: false,
            requireEmailVerification: true,
            resetPasswordTokenExpiresIn: 30 * 60,
            revokeSessionsOnPasswordReset: true,
          },
          advanced: { database: { generateId: "uuid" } },
        });
        const now = new Date();
        const result = await auth.api.signUpEmail({
          body: {
            name: "Spike User",
            email,
            password: "correct-horse-battery-staple-003",
            callbackURL: "/verify-email",
          },
        });
        if (!verificationCallbackCompleted) {
          throw new Error("verification callback returned before persistence");
        }
        await transaction.insert(identityProfiles).values({
          accountId: result.user.id,
          displayName: result.user.name,
        });
        await transaction.insert(identityPolicyAcceptances).values([
          {
            accountId: result.user.id,
            policyType: "terms",
            policyVersion: "spike-terms-v1",
            acceptedAt: now,
          },
          {
            accountId: result.user.id,
            policyType: "privacy",
            policyVersion: "spike-privacy-v1",
            acceptedAt: now,
          },
        ]);
        await transaction.insert(identityAuditEvents).values({
          accountId: result.user.id,
          action: "identity.signup_requested.v1",
          payload: { source: "session-003-compatibility-spike" },
          occurredAt: now,
        });
        if (options.forceRollback) {
          throw new Error("session-003-forced-rollback");
        }
      });
      return { verificationCallbackCompleted };
    },
    requestPasswordReset: async (email, options = {}) => {
      let resetCallbackCompleted = false;
      let plaintextToken = "";
      let persistedPayload = "";
      await database.transaction(async (transaction) => {
        const accountRows = await transaction
          .select({ id: identityAccounts.id })
          .from(identityAccounts)
          .where(eq(identityAccounts.email, email.toLowerCase()))
          .for("update");
        const account = accountRows[0];
        if (account) {
          await options.afterAccountLocked?.();
          await transaction
            .delete(identityVerifications)
            .where(
              and(
                eq(identityVerifications.value, account.id),
                like(identityVerifications.identifier, "reset-password:%"),
              ),
            );
          if (options.forceFailureAt === "after-invalidation") {
            throw new Error("session-003-forced-after-invalidation");
          }
        }
        const auth = createResetAuth(
          transaction,
          async ({ user, url: resetUrl, token }) => {
              plaintextToken = token;
              persistedPayload = encryptPayload(
                { email: user.email, token, url: resetUrl },
                outboxSecret,
              );
              await transaction.insert(identityEmailOutbox).values({
                accountId: user.id,
                template: "reset_password",
                recipientHash: hashRecipient(user.email, outboxSecret),
                encryptedPayload: persistedPayload,
                keyVersion: "spike-v1",
              });
              resetCallbackCompleted = true;
          },
        );
        await auth.api.requestPasswordReset({
          body: { email, redirectTo: "/reset-password" },
        });
        if (!account) return;
        if (!resetCallbackCompleted) {
          throw new Error("reset callback returned before persistence");
        }
        if (options.forceFailureAt === "after-outbox") {
          throw new Error("session-003-forced-after-outbox");
        }
        await transaction.insert(identityAuditEvents).values({
          accountId: account.id,
          action: "identity.password_reset_requested.v1",
          payload: { source: "session-003-compatibility-spike" },
          occurredAt: new Date(),
        });
        if (options.forceRollback) {
          throw new Error("session-003-forced-rollback");
        }
      });
      return { resetCallbackCompleted, plaintextToken, persistedPayload };
    },
    resetPassword: async (token) => {
      const auth = createResetAuth(database, async () => undefined);
      const response = await auth.api.resetPassword({
        body: {
          newPassword: "correct-horse-battery-staple-reset-003",
          token,
        },
        asResponse: true,
      });
      return response.status;
    },
    seedVerificationRows: async (email, identifiers) => {
      const accountId = await findAccountId(email);
      if (!accountId) throw new Error("SESSION-003 seed account was not found");
      await database.insert(identityVerifications).values(
        identifiers.map((identifier) => ({
          identifier,
          value: accountId,
          expiresAt: new Date(Date.now() + 60_000),
        })),
      );
    },
    listVerificationIdentifiers: async (email) => {
      const accountId = await findAccountId(email);
      if (!accountId) return [];
      const rows = await database
        .select({ identifier: identityVerifications.identifier })
        .from(identityVerifications)
        .where(eq(identityVerifications.value, accountId));
      return rows.map((row) => row.identifier);
    },
    publicRequestPasswordReset: async (email, { ipAddress }) => {
      const now = Date.now();
      const previous = rateLimitAttempts.get(ipAddress);
      const current =
        previous && now - previous.windowStartedAt < 60_000
          ? previous
          : { count: 0, windowStartedAt: now };
      if (current.count >= 3) {
        const retryAfter = Math.max(
          1,
          Math.ceil((current.windowStartedAt + 60_000 - now) / 1_000),
        );
        return Response.json(
          { message: "Too many requests" },
          { status: 429, headers: { "x-retry-after": String(retryAfter) } },
        );
      }
      current.count += 1;
      rateLimitAttempts.set(ipAddress, current);
      await database.transaction(async (transaction) => {
        const auth = createResetAuth(transaction, async () => undefined);
        await auth.api.requestPasswordReset({
          body: { email, redirectTo: "/reset-password" },
        });
      });
      return Response.json({
        status: true,
        message:
          "If this email exists in our system, check your email for the reset link",
      });
    },
    countSignupRows,
    countResetRows,
  };
}
