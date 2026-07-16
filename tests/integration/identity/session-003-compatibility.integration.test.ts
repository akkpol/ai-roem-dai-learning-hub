import { and, desc, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import * as forgotPasswordRoute from "@/app/api/auth/forgot-password/route";
import * as resetPasswordRoute from "@/app/api/auth/reset-password/route";
import * as signInRoute from "@/app/api/auth/sign-in/route";
import * as signOutRoute from "@/app/api/auth/sign-out/route";
import * as signUpRoute from "@/app/api/auth/sign-up/route";
import * as verifyEmailRoute from "@/app/api/auth/verify-email/route";
import { readIdentityConfig, type IdentityConfig } from "@/modules/identity/config";
import {
  parseResetPasswordCommand,
  parseResetRequestCommand,
  parseSignInCommand,
  parseSignUpCommand,
} from "@/modules/identity/contracts";
import { decryptAuthEmailIntent, type AuthEmailIntent } from "@/modules/identity/email/crypto";
import { createAuthHttpHandlers } from "@/modules/identity/http";
import { consumeIdentityRateLimit } from "@/modules/identity/rate-limit";
import {
  identityAccounts,
  identityEmailOutbox,
  identityVerifications,
} from "@/modules/identity/schema";
import {
  createIdentityService,
  type IdentityServiceTestHooks,
} from "@/modules/identity/service";
import {
  createDatabaseConnection,
  getRuntimeDatabaseConnection,
  type DatabaseConnection,
} from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";
import { runMigrations } from "../../../scripts/database/run-migrations";

const originalEnvironment = { ...process.env };
let connection: DatabaseConnection;
let config: IdentityConfig;
let routeRuntimeUsed = false;

function requireProofDatabaseUrl(): string {
  const value = process.env.SESSION_003_SPIKE_DATABASE_URL;
  if (!value) throw new Error("SESSION_003_SPIKE_DATABASE_URL is required");
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("SESSION_003 production proof requires PostgreSQL");
  }
  if (!parsed.pathname.slice(1).endsWith("_test")) {
    throw new Error("SESSION_003 production proof database must end in _test");
  }
  return value;
}

function service(testHooks?: IdentityServiceTestHooks) {
  return createIdentityService(connection.db, config, testHooks);
}

function handlers(testHooks?: IdentityServiceTestHooks) {
  return createAuthHttpHandlers({
    config,
    service: service(testHooks),
    consumeRateLimit: ({ endpoint, clientIp, windowSeconds, max }) =>
      consumeIdentityRateLimit(
        connection.db,
        config.authSecret,
        endpoint,
        clientIp,
        { windowSeconds, max },
      ),
  });
}

function signupCommand(email: string) {
  return parseSignUpCommand(
    {
      displayName: "Production Proof Learner",
      email,
      password: "correct-horse-battery-staple-old",
      ageAttested: true,
      termsVersion: config.termsVersion,
      privacyVersion: config.privacyVersion,
      callbackPath: "/verify-email",
    },
    config,
  );
}

async function signUp(email: string, testHooks?: IdentityServiceTestHooks) {
  return service(testHooks).signUp(signupCommand(email));
}

async function accountId(email: string): Promise<string> {
  const rows = await connection.db
    .select({ id: identityAccounts.id })
    .from(identityAccounts)
    .where(eq(identityAccounts.email, email));
  if (!rows[0]) throw new Error("production proof account was not found");
  return rows[0].id;
}

async function latestEmail(
  email: string,
  template: "verify_email" | "reset_password",
): Promise<AuthEmailIntent> {
  const id = await accountId(email);
  const rows = await connection.db
    .select({ encryptedPayload: identityEmailOutbox.encryptedPayload })
    .from(identityEmailOutbox)
    .where(
      and(
        eq(identityEmailOutbox.accountId, id),
        eq(identityEmailOutbox.template, template),
      ),
    )
    .orderBy(desc(identityEmailOutbox.createdAt), desc(identityEmailOutbox.id));
  if (!rows[0]) throw new Error("production proof email was not found");
  return decryptAuthEmailIntent(rows[0].encryptedPayload, config.emailEncryptionKey);
}

async function requestReset(email: string, testHooks?: IdentityServiceTestHooks) {
  await service(testHooks).requestPasswordReset(
    parseResetRequestCommand({ email, redirectPath: "/reset-password" }),
  );
  return latestEmail(email, "reset_password");
}

async function reset(token: string, newPassword = "correct-horse-battery-staple-new") {
  return service().resetPassword(parseResetPasswordCommand({ token, newPassword }));
}

async function resetCounts(email: string) {
  const result = await connection.pool.query<{
    verifications: string;
    email_outbox: string;
    reset_audits: string;
  }>(`
    select
      count(distinct v.id) as verifications,
      count(distinct o.id) as email_outbox,
      count(distinct a.id) as reset_audits
    from (select $1::text as email) input
    left join identity_accounts i on i.email = input.email
    left join identity_verifications v
      on v.value = i.id::text and v.identifier like 'reset-password:%'
    left join identity_email_outbox o
      on o.account_id = i.id and o.template = 'reset_password'
    left join identity_audit_events a
      on a.account_id = i.id and a.action = 'identity.password_reset_requested.v1'
  `, [email]);
  const row = result.rows[0]!;
  return {
    verifications: Number(row.verifications),
    emailOutbox: Number(row.email_outbox),
    resetAudits: Number(row.reset_audits),
  };
}

function post(url: string, body: object, ip = "203.0.113.10") {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://learning.example.test",
      "x-vercel-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const url = requireProofDatabaseUrl();
  await runMigrations(url);
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: url,
    DATABASE_POOL_MAX: "4",
    AUTH_SECRET: "session-003-production-proof-auth-secret",
    AUTH_BASE_URL: "https://learning.example.test/api/auth",
    AUTH_EMAIL_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64"),
    AUTH_EMAIL_KEY_VERSION: "production-proof-v1",
    AUTH_TERMS_VERSION: "production-proof-terms-v1",
    AUTH_PRIVACY_VERSION: "production-proof-privacy-v1",
    AUTH_EMAIL_FROM: "Learning Hub <auth@learning.example.test>",
    VERCEL: "1",
  });
  config = readIdentityConfig(process.env);
  connection = createDatabaseConnection(readDatabaseConfig(process.env));
});

afterAll(async () => {
  await connection?.close();
  if (routeRuntimeUsed) await getRuntimeDatabaseConnection().close();
  process.env = originalEnvironment;
});

describe("SESSION-003 production D-011/D-013 compatibility", () => {
  it("proves signup rollback through createIdentityService", async () => {
    const email = `signup-rollback-${crypto.randomUUID()}@example.test`;
    await expect(
      signUp(email, {
        afterSignupWrites: async () => {
          throw new Error("production-proof-signup-rollback");
        },
      }),
    ).rejects.toThrow("production-proof-signup-rollback");
    const rows = await connection.pool.query<{ count: string }>(
      "select count(*)::text as count from identity_accounts where email = $1",
      [email],
    );
    expect(Number(rows.rows[0]!.count)).toBe(0);
  });

  it("keeps new, existing, and concurrent duplicate signup HTTP responses identical", async () => {
    const email = `signup-generic-${crypto.randomUUID()}@example.test`;
    const body = {
      displayName: "Production Proof Learner",
      email,
      password: "correct-horse-battery-staple-old",
      ageAttested: true,
      termsVersion: config.termsVersion,
      privacyVersion: config.privacyVersion,
      callbackPath: "/verify-email",
    };
    const first = await handlers().signUp(post("https://learning.example.test/api/auth/sign-up", body));
    const existing = await handlers().signUp(post("https://learning.example.test/api/auth/sign-up", body));
    const concurrentEmail = `signup-concurrent-${crypto.randomUUID()}@example.test`;
    const concurrentBody = { ...body, email: concurrentEmail };
    const concurrent = await Promise.all([
      handlers().signUp(post("https://learning.example.test/api/auth/sign-up", concurrentBody, "203.0.113.11")),
      handlers().signUp(post("https://learning.example.test/api/auth/sign-up", concurrentBody, "203.0.113.12")),
    ]);
    const responses = [first, existing, ...concurrent];
    const publicShapes = await Promise.all(
      responses.map(async (response) => [response.status, await response.text()]),
    );
    expect(new Set(publicShapes.map((shape) => JSON.stringify(shape))).size).toBe(1);
  });

  it("proves sequential reset invalidates the older token and consumes the latest once", async () => {
    const email = `sequential-reset-${crypto.randomUUID()}@example.test`;
    await signUp(email);
    const first = await requestReset(email);
    const second = await requestReset(email);
    await expect(reset(first.token)).resolves.toMatchObject({ status: 400 });
    await expect(reset(second.token)).resolves.toMatchObject({ status: 200 });
    await expect(reset(second.token)).resolves.toMatchObject({ status: 400 });
  });

  it("proves concurrent reset serialization on the production account lock", async () => {
    const email = `concurrent-reset-${crypto.randomUUID()}@example.test`;
    await signUp(email);
    let announceLock!: () => void;
    const firstHasLock = new Promise<void>((resolve) => { announceLock = resolve; });
    let releaseLock!: () => void;
    const firstMayCommit = new Promise<void>((resolve) => { releaseLock = resolve; });
    const first = requestReset(email, {
      afterResetAccountLocked: async () => {
        announceLock();
        await firstMayCommit;
      },
    });
    await firstHasLock;
    const second = requestReset(email);
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseLock();
    const [older, later] = await Promise.all([first, second]);
    await expect(reset(older.token)).resolves.toMatchObject({ status: 400 });
    await expect(reset(later.token)).resolves.toMatchObject({ status: 200 });
  });

  it.each([
    ["rollback after invalidation", "afterResetInvalidation"],
    ["rollback after outbox", "afterResetOutbox"],
  ] as const)("proves %s preserves the previously committed token", async (_name, hook) => {
    const email = `${hook}-${crypto.randomUUID()}@example.test`;
    await signUp(email);
    const previous = await requestReset(email);
    const before = await resetCounts(email);
    await expect(
      service({
        [hook]: async () => {
          throw new Error(`production-proof-${hook}`);
        },
      }).requestPasswordReset(
        parseResetRequestCommand({ email, redirectPath: "/reset-password" }),
      ),
    ).rejects.toThrow(`production-proof-${hook}`);
    await expect(resetCounts(email)).resolves.toEqual(before);
    await expect(reset(previous.token)).resolves.toMatchObject({ status: 200 });
  });

  it("proves namespace and account isolation", async () => {
    const target = `namespace-target-${crypto.randomUUID()}@example.test`;
    const other = `namespace-other-${crypto.randomUUID()}@example.test`;
    await signUp(target);
    await signUp(other);
    const targetPrevious = await requestReset(target);
    const otherPrevious = await requestReset(other);
    const targetId = await accountId(target);
    await connection.db.insert(identityVerifications).values([
      { identifier: "email-verification:keep", value: targetId, expiresAt: new Date(Date.now() + 60_000) },
      { identifier: "other-purpose:keep", value: targetId, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    await requestReset(target);
    const identifiers = await connection.db
      .select({ identifier: identityVerifications.identifier })
      .from(identityVerifications)
      .where(eq(identityVerifications.value, targetId));
    expect(identifiers.map((row) => row.identifier)).toEqual(
      expect.arrayContaining(["email-verification:keep", "other-purpose:keep"]),
    );
    await expect(reset(targetPrevious.token)).resolves.toMatchObject({ status: 400 });
    await expect(reset(otherPrevious.token)).resolves.toMatchObject({ status: 200 });
  });

  it("proves unknown email equivalence and the production rate limit", async () => {
    const known = `known-${crypto.randomUUID()}@example.test`;
    await signUp(known);
    routeRuntimeUsed = true;
    const knownResponse = await forgotPasswordRoute.POST(
      post("https://learning.example.test/api/auth/forgot-password", { email: known, redirectPath: "/reset-password" }, "203.0.113.20"),
    );
    const unknownResponse = await forgotPasswordRoute.POST(
      post("https://learning.example.test/api/auth/forgot-password", { email: `unknown-${crypto.randomUUID()}@example.test`, redirectPath: "/reset-password" }, "203.0.113.21"),
    );
    expect([knownResponse.status, await knownResponse.text()]).toEqual([
      unknownResponse.status,
      await unknownResponse.text(),
    ]);
    const rateIp = "203.0.113.22";
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () =>
        forgotPasswordRoute.POST(
          post("https://learning.example.test/api/auth/forgot-password", { email: `unknown-${crypto.randomUUID()}@example.test` }, rateIp),
        ),
      ),
    );
    expect(attempts.map((response) => response.status).sort()).toEqual([200, 200, 200, 429]);
  });

  it("proves route non-bypass through the real route exports", () => {
    expect([
      Object.keys(signUpRoute),
      Object.keys(verifyEmailRoute),
      Object.keys(signInRoute),
      Object.keys(forgotPasswordRoute),
      Object.keys(resetPasswordRoute),
      Object.keys(signOutRoute),
    ]).toEqual([["POST"], ["GET"], ["POST"], ["POST"], ["POST"], ["POST"]]);
  });

  it("proves the email link initializes the page and the production reset route accepts the new password", async () => {
    const email = `reset-page-${crypto.randomUUID()}@example.test`;
    await signUp(email);
    const verification = await latestEmail(email, "verify_email");
    await service().verifyEmail(verification.token);
    const resetEmail = await requestReset(email);
    const emailedToken = new URL(resetEmail.url).searchParams.get("token");
    const markup = renderToStaticMarkup(
      await ResetPasswordPage({ searchParams: Promise.resolve({ token: emailedToken ?? undefined }) }),
    );
    const tokenInput = markup.match(/<input(?=[^>]*name="token")[^>]*>/)?.[0];
    const initializedToken = tokenInput?.match(/value="([^"]+)"/)?.[1];
    expect(initializedToken).toBe(emailedToken);
    routeRuntimeUsed = true;
    const response = await resetPasswordRoute.POST(
      post("https://learning.example.test/api/auth/reset-password", {
        token: initializedToken,
        newPassword: "correct-horse-battery-staple-page",
      }, "203.0.113.30"),
    );
    expect(response.status).toBe(200);
    const signIn = await service().signIn(
      parseSignInCommand({
        email,
        password: "correct-horse-battery-staple-page",
        callbackPath: "/",
      }),
      new Headers(),
    );
    expect(signIn.status).toBe(200);
  });
});
