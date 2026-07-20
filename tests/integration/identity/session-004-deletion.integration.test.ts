import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { createDatabaseConnection, type DatabaseConnection } from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";
import {
  createIdentityPrivacyService,
  hashDeletionToken,
} from "@/modules/identity/privacy";
import {
  identityAccountDeletionRequests,
  identityAccounts,
  identitySessions,
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

beforeAll(() => {
  connection = createDatabaseConnection(readDatabaseConfig(process.env));
});

afterAll(async () => connection.close());

async function seedDeletionRequest(rawToken: string) {
  const accountId = randomUUID();
  const requestId = randomUUID();
  const sessionId = randomUUID();
  await connection.db.insert(identityAccounts).values({
    id: accountId,
    name: "Deletion Test",
    email: `${accountId}@example.test`,
    emailVerified: true,
    status: "active",
    ageAttestedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  await connection.db.insert(identitySessions).values({
    id: sessionId,
    token: randomUUID(),
    userId: accountId,
    expiresAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  await connection.db.insert(identityAccountDeletionRequests).values({
    id: requestId,
    accountId,
    state: "requested",
    confirmationTokenHash: hashDeletionToken(rawToken, config.authSecret),
    confirmationExpiresAt: new Date(Date.now() + 30 * 60_000),
  });
  return { accountId, requestId, sessionId };
}

it("rolls back status, request, and session revocation when scheduling fails", async () => {
  const token = randomUUID();
  const seeded = await seedDeletionRequest(token);
  const privacy = createIdentityPrivacyService(connection.db, config, {
    afterDeletionScheduledWrites: async () => {
      throw new Error("forced scheduling failure");
    },
  });

  await expect(privacy.confirmDeletion(token)).rejects.toThrow("forced scheduling failure");
  await expect(
    connection.db.select({ status: identityAccounts.status }).from(identityAccounts).where(eq(identityAccounts.id, seeded.accountId)),
  ).resolves.toEqual([{ status: "active" }]);
  await expect(
    connection.db.select({ state: identityAccountDeletionRequests.state }).from(identityAccountDeletionRequests).where(eq(identityAccountDeletionRequests.id, seeded.requestId)),
  ).resolves.toEqual([{ state: "requested" }]);
  await expect(
    connection.db.select({ id: identitySessions.id }).from(identitySessions).where(eq(identitySessions.id, seeded.sessionId)),
  ).resolves.toHaveLength(1);
});

it("serializes concurrent confirmation so a token schedules deletion once", async () => {
  const token = randomUUID();
  const seeded = await seedDeletionRequest(token);
  const privacy = createIdentityPrivacyService(connection.db, config);

  const results = await Promise.allSettled([
    privacy.confirmDeletion(token),
    privacy.confirmDeletion(token),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  await expect(
    connection.db.select({ state: identityAccountDeletionRequests.state }).from(identityAccountDeletionRequests).where(eq(identityAccountDeletionRequests.id, seeded.requestId)),
  ).resolves.toEqual([{ state: "scheduled" }]);
});
