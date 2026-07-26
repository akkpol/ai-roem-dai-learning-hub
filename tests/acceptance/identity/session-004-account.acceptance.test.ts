import { createHmac, randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";
import { createAccountSecurityService } from "@/modules/identity/account-security";
import { parseSignInCommand, parseSignUpCommand } from "@/modules/identity/contracts";
import { decryptAuthEmailIntent } from "@/modules/identity/email/crypto";
import { createIdentityPrivacyService } from "@/modules/identity/privacy";
import { createIdentityService } from "@/modules/identity/service";
import {
  identityAccounts,
  identityAccountDeletionRequests,
  identityEmailOutbox,
  identityGlobalRoleGrants,
} from "@/modules/identity/schema";

const config = {
  authSecret: "s".repeat(32),
  baseUrl: "https://learning.example.test/api/auth",
  emailEncryptionKey: Buffer.alloc(32),
  emailKeyVersion: "v1",
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  emailFrom: "Learning Hub <auth@learning.example.test>",
  trustedProxy: "none" as const,
};

let connection: DatabaseConnection;
let operatorConnection: DatabaseConnection;

beforeAll(() => {
  connection = createDatabaseConnection(readDatabaseConfig(process.env));
  operatorConnection = createDatabaseConnection(
    readDatabaseConfig({
      ...process.env,
      DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
    }),
  );
});

afterAll(async () => {
  await connection.close();
  await operatorConnection.close();
});

function sessionHeaders(headers: Headers) {
  const values = headers.getSetCookie();
  const cookie = values.map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie) throw new Error("session cookie was not returned");
  return new Headers({ cookie });
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("invalid base32 secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(uri: string) {
  const secret = new URL(uri).searchParams.get("secret");
  if (!secret) throw new Error("TOTP secret unavailable");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function latestIntent(accountId: string, template: string) {
  const rows = await connection.db
    .select({
      encryptedPayload: identityEmailOutbox.encryptedPayload,
      template: identityEmailOutbox.template,
    })
    .from(identityEmailOutbox)
    .where(
      eq(identityEmailOutbox.accountId, accountId),
    )
    .orderBy(desc(identityEmailOutbox.createdAt));
  const payload = rows.find((row) => row.template === template && row.encryptedPayload);
  if (!payload?.encryptedPayload) throw new Error(`${template} email unavailable`);
  return decryptAuthEmailIntent(payload.encryptedPayload, config.emailEncryptionKey);
}

it("updates profile and password, enables 2FA, exports, schedules and cancels deletion", async () => {
  const email = `session-004-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple-old";
  const newPassword = "correct-horse-battery-staple-new";
  const identity = createIdentityService(connection.db, config);
  const security = createAccountSecurityService(connection.db, config);
  const privacy = createIdentityPrivacyService(connection.db, config);

  await identity.signUp(
    parseSignUpCommand(
      {
        displayName: "ผู้เรียนทดสอบ",
        email,
        password,
        termsVersion: config.termsVersion,
        privacyVersion: config.privacyVersion,
        callbackPath: "/verify-email",
      },
      config,
    ),
  );
  const account = await connection.db
    .select({ id: identityAccounts.id })
    .from(identityAccounts)
    .where(eq(identityAccounts.email, email));
  const accountId = account[0]!.id;
  await operatorConnection.db.insert(identityGlobalRoleGrants).values({
    accountId,
    role: "reviewer",
    reasonCode: "acceptance_export",
  });
  await identity.verifyEmail((await latestIntent(accountId, "verify_email")).token);
  const signedIn = await identity.signIn(
    parseSignInCommand({ email, password, callbackPath: "/" }),
    new Headers(),
  );
  let headers = sessionHeaders(signedIn.headers);

  await expect(
    security.updateOwnProfile(headers, {
      displayName: "ชื่อใหม่",
      locale: "th-TH",
      timeZone: "Asia/Bangkok",
    }),
  ).resolves.toEqual({ status: true });
  await expect(security.listPolicyHistory(headers)).resolves.toHaveLength(2);
  await expect(security.listDeviceSessions(headers)).resolves.toHaveLength(1);
  const passwordChanged = await security.changePassword(headers, {
    currentPassword: password,
    newPassword,
  });
  expect(passwordChanged.status).toBe(true);
  headers = sessionHeaders(passwordChanged.headers);

  const enrollment = await security.beginTwoFactorEnrollment(headers, newPassword);
  expect(enrollment.backupCodes.length).toBeGreaterThan(0);
  const totp = currentTotp(enrollment.totpURI);
  const confirmed = await security.confirmTwoFactorEnrollment(headers, totp);
  headers = sessionHeaders(confirmed.headers);
  const replacementCodes = await security.regenerateRecoveryCodes(headers, newPassword);
  expect(replacementCodes.backupCodes).not.toEqual(enrollment.backupCodes);

  const secondSignIn = await identity.signIn(
    parseSignInCommand({ email, password: newPassword, callbackPath: "/" }),
    new Headers(),
  );
  expect(secondSignIn.body.requiresTwoFactor).toBe(true);
  const continuationHeaders = sessionHeaders(secondSignIn.headers);
  const recoveryCode = replacementCodes.backupCodes[0]!;
  const recoveryVerified = await security.verifySignInSecondFactor(
    continuationHeaders,
    { kind: "recovery", code: recoveryCode },
  );
  headers = sessionHeaders(recoveryVerified.headers);
  await expect(
    security.verifySignInSecondFactor(continuationHeaders, {
      kind: "recovery",
      code: recoveryCode,
    }),
  ).rejects.toThrow();

  const exported = await privacy.exportOwnIdentity(headers, {
    kind: "totp",
    code: currentTotp(enrollment.totpURI),
  });
  expect(exported.account).toMatchObject({ id: accountId, email, twoFactorEnabled: true });
  expect(exported.activeRoleGrants).toEqual([
    expect.objectContaining({ role: "reviewer" }),
  ]);
  expect(JSON.stringify(exported)).not.toContain("correct-horse");

  await privacy.requestDeletion(headers, newPassword, {
    kind: "totp",
    code: currentTotp(enrollment.totpURI),
  });
  const deletionIntent = await latestIntent(accountId, "deletion_confirmation");
  expect(deletionIntent.template).toBe("deletion_confirmation");
  await expect(privacy.confirmDeletion(deletionIntent.token)).resolves.toMatchObject({
    status: true,
  });
  const scheduledSignIn = await identity.signIn(
    parseSignInCommand({ email, password: newPassword, callbackPath: "/" }),
    new Headers(),
  );
  const unknownSignIn = await identity.signIn(
    parseSignInCommand({
      email: `unknown-${randomUUID()}@example.test`,
      password: newPassword,
      callbackPath: "/",
    }),
    new Headers(),
  );
  expect(scheduledSignIn).toMatchObject({ status: 401, body: unknownSignIn.body });
  expect(scheduledSignIn.headers.get("set-cookie")).toBeNull();
  await connection.db
    .update(identityAccountDeletionRequests)
    .set({ scheduledFor: new Date(Date.now() - 1) })
    .where(eq(identityAccountDeletionRequests.accountId, accountId));
  await expect(
    privacy.cancelDeletion(new Headers(), {
      email,
      password: newPassword,
      proof: { kind: "totp", code: currentTotp(enrollment.totpURI) },
    }),
  ).rejects.toThrow("cancellation request is unavailable");
  await connection.db
    .update(identityAccountDeletionRequests)
    .set({ scheduledFor: new Date(Date.now() + 60_000) })
    .where(eq(identityAccountDeletionRequests.accountId, accountId));
  const cancelled = await privacy.cancelDeletion(new Headers(), {
    email,
    password: newPassword,
    proof: { kind: "totp", code: currentTotp(enrollment.totpURI) },
  });
  expect(cancelled.status).toBe(true);
  expect(cancelled.headers.get("set-cookie")).toBeTruthy();
  const active = await connection.db
    .select({ status: identityAccounts.status })
    .from(identityAccounts)
    .where(eq(identityAccounts.id, accountId));
  expect(active[0]?.status).toBe("active");
});
