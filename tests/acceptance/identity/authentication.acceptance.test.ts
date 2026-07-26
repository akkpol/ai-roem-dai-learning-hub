import { desc, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import { readIdentityConfig } from "@/modules/identity/config";
import { decryptAuthEmailIntent } from "@/modules/identity/email/crypto";
import {
  identityAccounts,
  identityEmailOutbox,
  identitySessions,
} from "@/modules/identity/schema";
import { createIdentityService } from "@/modules/identity/service";
import { createAuthHttpHandlers } from "@/modules/identity/http";
import { consumeIdentityRateLimit } from "@/modules/identity/rate-limit";
import {
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

  afterAll(async () => connection?.close());

  it("signs up, verifies, signs in, resets, and revokes the previous session", async () => {
    const config = readIdentityConfig(process.env);
    const service = createIdentityService(connection.db, config);
    const handlers = createAuthHttpHandlers({
      config,
      service,
      consumeRateLimit: ({ endpoint, clientIp, windowSeconds, max }) =>
        consumeIdentityRateLimit(
          connection.db,
          config.authSecret,
          endpoint,
          clientIp,
          { windowSeconds, max },
        ),
    });
    const email = `acceptance-${crypto.randomUUID()}@example.test`;
    const signUp = parseSignUpCommand(
      {
        displayName: "Acceptance Learner",
        email,
        password: "correct-horse-battery-staple-old",
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
    const verificationPayload = verificationMessages[0]?.encryptedPayload;
    if (!verificationPayload) throw new Error("verification payload was not found");
    const verification = decryptAuthEmailIntent(
      verificationPayload,
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
    const resetPayload = resetMessages[0]?.encryptedPayload;
    if (!resetPayload) throw new Error("reset payload was not found");
    const reset = decryptAuthEmailIntent(
      resetPayload,
      config.emailEncryptionKey,
    );
    const emailedToken = new URL(reset.url).searchParams.get("token");
    const resetPage = renderToStaticMarkup(
      await ResetPasswordPage({
        searchParams: Promise.resolve({ token: emailedToken ?? undefined }),
      }),
    );
    const tokenInput = resetPage.match(/<input(?=[^>]*name="token")[^>]*>/)?.[0];
    const initializedToken = tokenInput?.match(/value="([^"]+)"/)?.[1];
    expect(initializedToken).toBe(reset.token);
    const result = await handlers.resetPassword(
      new Request(`${config.baseUrl}/reset-password`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: new URL(config.baseUrl).origin,
        },
        body: JSON.stringify({
          token: initializedToken,
          newPassword: "correct-horse-battery-staple-new",
        }),
      }),
    );
    expect(result.status).toBe(200);
    expect(
      await connection.db
        .select({ id: identitySessions.id })
        .from(identitySessions)
        .where(eq(identitySessions.userId, account[0]!.id)),
    ).toHaveLength(0);
    await expect(
      service.signIn(
        parseSignInCommand({
          email,
          password: "correct-horse-battery-staple-new",
          callbackPath: "/",
        }),
        new Headers(),
      ),
    ).resolves.toMatchObject({ status: 200 });
  });
});
