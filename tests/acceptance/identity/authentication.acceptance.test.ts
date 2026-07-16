import { desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readIdentityConfig } from "@/modules/identity/config";
import { decryptAuthEmailIntent } from "@/modules/identity/email/crypto";
import {
  identityAccounts,
  identityEmailOutbox,
  identitySessions,
} from "@/modules/identity/schema";
import { createIdentityService } from "@/modules/identity/service";
import {
  parseResetPasswordCommand,
  parseResetRequestCommand,
  parseSignInCommand,
  parseSignUpCommand,
} from "@/modules/identity/contracts";
import {
  createDatabaseConnection,
  type DatabaseConnection,
} from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";

describe("SESSION-003 authentication acceptance", () => {
  let connection: DatabaseConnection;

  beforeAll(() => {
    connection = createDatabaseConnection(readDatabaseConfig(process.env));
  });

  afterAll(async () => connection.close());

  it("signs up, verifies, signs in, resets, and revokes the previous session", async () => {
    const config = readIdentityConfig(process.env);
    const service = createIdentityService(connection.db, config);
    const email = `acceptance-${crypto.randomUUID()}@example.test`;
    const signUp = parseSignUpCommand(
      {
        displayName: "Acceptance Learner",
        email,
        password: "correct-horse-battery-staple-old",
        ageAttested: true,
        termsVersion: config.termsVersion,
        privacyVersion: config.privacyVersion,
        callbackPath: "/verify-email",
      },
      config,
    );

    await expect(service.signUp(signUp)).resolves.toMatchObject({ status: true });
    const account = await connection.db
      .select({ id: identityAccounts.id, status: identityAccounts.status })
      .from(identityAccounts)
      .where(eq(identityAccounts.email, email));
    expect(account[0]?.status).toBe("pending_verification");

    const verificationMessages = await connection.db
      .select({ encryptedPayload: identityEmailOutbox.encryptedPayload })
      .from(identityEmailOutbox)
      .where(eq(identityEmailOutbox.accountId, account[0]!.id))
      .orderBy(desc(identityEmailOutbox.createdAt));
    const verification = decryptAuthEmailIntent(
      verificationMessages[0]!.encryptedPayload,
      config.emailEncryptionKey,
    );
    await expect(service.verifyEmail(verification.token)).resolves.toMatchObject({
      status: true,
    });

    const signIn = await service.signIn(
      parseSignInCommand({
        email,
        password: "correct-horse-battery-staple-old",
        callbackPath: "/",
      }),
      new Headers(),
    );
    expect(signIn.status).toBe(200);
    expect(signIn.headers.get("set-cookie")).toBeTruthy();
    expect(
      await connection.db
        .select({ id: identitySessions.id })
        .from(identitySessions)
        .where(eq(identitySessions.userId, account[0]!.id)),
    ).toHaveLength(1);

    await service.requestPasswordReset(
      parseResetRequestCommand({ email, redirectPath: "/reset-password" }),
    );
    const resetMessages = await connection.db
      .select({ encryptedPayload: identityEmailOutbox.encryptedPayload })
      .from(identityEmailOutbox)
      .where(eq(identityEmailOutbox.accountId, account[0]!.id))
      .orderBy(desc(identityEmailOutbox.createdAt));
    const reset = decryptAuthEmailIntent(
      resetMessages[0]!.encryptedPayload,
      config.emailEncryptionKey,
    );
    const result = await service.resetPassword(
      parseResetPasswordCommand({
        token: reset.token,
        newPassword: "correct-horse-battery-staple-new",
      }),
    );
    expect(result.status).toBe(200);
    expect(
      await connection.db
        .select({ id: identitySessions.id })
        .from(identitySessions)
        .where(eq(identitySessions.userId, account[0]!.id)),
    ).toHaveLength(0);
  });
});
