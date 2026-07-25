import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

import {
  createPostgresAuthEmailOutboxRepository,
} from "@/modules/identity/email/dispatcher";
import { createPostgresResendDeliveryLedger } from "@/modules/identity/email/webhook";
import {
  identityAccounts,
  identityEmailDeliveries,
  identityEmailOutbox,
} from "@/modules/identity/schema";
import {
  createDatabaseConnection,
  type DatabaseConnection,
} from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";

let owner: DatabaseConnection;
let appClient: Client;
const accountId = randomUUID();

beforeAll(async () => {
  owner = createDatabaseConnection(
    readDatabaseConfig({
      ...process.env,
      DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
    }),
  );
  appClient = new Client({ connectionString: process.env.DATABASE_URL });
  await appClient.connect();
  await owner.db.insert(identityAccounts).values({
    id: accountId,
    name: "SESSION-006 email operations",
    email: `${accountId}@example.test`,
    emailVerified: true,
    status: "active",
    ageAttestedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
});

afterAll(async () => {
  await owner.db
    .delete(identityEmailDeliveries)
    .where(eq(identityEmailDeliveries.providerMessageId, "resend-session-006"));
  await owner.db
    .delete(identityEmailOutbox)
    .where(eq(identityEmailOutbox.accountId, accountId));
  await owner.db.delete(identityAccounts).where(eq(identityAccounts.id, accountId));
  await appClient.end();
  await owner.close();
});

async function seedOutbox(count: number) {
  return owner.db
    .insert(identityEmailOutbox)
    .values(
      Array.from({ length: count }, () => ({
        accountId,
        template: "verify_email",
        recipientHash: randomUUID(),
        encryptedPayload: "v1.test.test.test",
        keyVersion: "v1",
        expiresAt: new Date(Date.now() + 30 * 60_000),
      })),
    )
    .returning({ id: identityEmailOutbox.id });
}

it("atomically claims distinct rows under concurrent workers and enforces lease ownership", async () => {
  const seeded = await seedOutbox(2);
  const repository = createPostgresAuthEmailOutboxRepository(owner.db);
  const now = new Date();
  const claims = await Promise.all([
    repository.claimBatch({ limit: 1, now, workerId: "worker-a" }),
    repository.claimBatch({ limit: 1, now, workerId: "worker-b" }),
  ]);
  const claimed = claims.flat();
  expect(claimed).toHaveLength(2);
  expect(new Set(claimed.map(({ id }) => id))).toEqual(
    new Set(seeded.map(({ id }) => id)),
  );

  await expect(
    repository.markSent({
      id: claimed[0].id,
      leaseToken: randomUUID(),
      providerMessageId: "wrong-lease",
      sentAt: now,
    }),
  ).rejects.toThrow("email outbox lease was lost");

  await repository.markSent({
    id: claimed[0].id,
    leaseToken: claimed[0].leaseToken,
    providerMessageId: "resend-session-006",
    sentAt: now,
  });
  await expect(
    owner.db
      .select({
        state: identityEmailOutbox.state,
        encryptedPayload: identityEmailOutbox.encryptedPayload,
      })
      .from(identityEmailOutbox)
      .where(eq(identityEmailOutbox.id, claimed[0].id)),
  ).resolves.toEqual([{ state: "sent", encryptedPayload: null }]);
});

it("atomically expires queued secrets and only reclaims an expired lease", async () => {
  const expiredAt = new Date(Date.now() - 60_000);
  const activeLeaseToken = randomUUID();
  const activeLeasePayload = "v1.expired.active-lease.secret";
  const seeded = await owner.db
    .insert(identityEmailOutbox)
    .values([
      {
        accountId,
        template: "verify_email",
        recipientHash: randomUUID(),
        encryptedPayload: "v1.expired.pending.secret",
        keyVersion: "v1",
        expiresAt: expiredAt,
      },
      {
        accountId,
        template: "reset_password",
        recipientHash: randomUUID(),
        encryptedPayload: "v1.expired.sending.secret",
        keyVersion: "v1",
        expiresAt: expiredAt,
        state: "sending",
        leaseToken: randomUUID(),
        leaseExpiresAt: expiredAt,
      },
      {
        accountId,
        template: "reset_password",
        recipientHash: randomUUID(),
        encryptedPayload: activeLeasePayload,
        keyVersion: "v1",
        expiresAt: expiredAt,
        state: "sending",
        leaseToken: activeLeaseToken,
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    ])
    .returning({ id: identityEmailOutbox.id });
  const repository = createPostgresAuthEmailOutboxRepository(owner.db);

  await expect(
    repository.expireStale({ now: new Date(), limit: 2 }),
  ).resolves.toBe(2);
  await expect(
    owner.db
      .select({
        id: identityEmailOutbox.id,
        state: identityEmailOutbox.state,
        encryptedPayload: identityEmailOutbox.encryptedPayload,
        leaseToken: identityEmailOutbox.leaseToken,
      })
      .from(identityEmailOutbox)
      .where(eq(identityEmailOutbox.accountId, accountId)),
  ).resolves.toEqual(
    expect.arrayContaining(
      seeded.slice(0, 2).map(({ id }) => ({
        id,
        state: "expired",
        encryptedPayload: null,
        leaseToken: null,
      })),
    ),
  );
  await expect(
    owner.db
      .select({
        state: identityEmailOutbox.state,
        encryptedPayload: identityEmailOutbox.encryptedPayload,
        leaseToken: identityEmailOutbox.leaseToken,
      })
      .from(identityEmailOutbox)
      .where(eq(identityEmailOutbox.id, seeded[2].id)),
  ).resolves.toEqual([
    {
      state: "sending",
      encryptedPayload: activeLeasePayload,
      leaseToken: activeLeaseToken,
    },
  ]);
});

it("dedupes webhook events atomically while retaining provider ordering", async () => {
  const ledger = createPostgresResendDeliveryLedger(owner.db);
  const duplicateInput = {
    eventId: "session-006-duplicate",
    providerMessageId: "resend-session-006",
    state: "delivered" as const,
    providerCreatedAt: new Date("2026-07-24T00:00:10.000Z"),
    receivedAt: new Date("2026-07-24T00:00:20.000Z"),
  };
  const duplicateResults = await Promise.all([
    ledger.record(duplicateInput),
    ledger.record(duplicateInput),
  ]);
  expect(duplicateResults).toContainEqual({ duplicate: false });
  expect(duplicateResults).toContainEqual({ duplicate: true });

  await ledger.record({
    eventId: "session-006-earlier",
    providerMessageId: "resend-session-006",
    state: "sent",
    providerCreatedAt: new Date("2026-07-24T00:00:05.000Z"),
    receivedAt: new Date("2026-07-24T00:00:30.000Z"),
  });
  await expect(
    owner.db
      .select({
        state: identityEmailDeliveries.state,
        providerCreatedAt: identityEmailDeliveries.providerCreatedAt,
      })
      .from(identityEmailDeliveries)
      .where(
        eq(
          identityEmailDeliveries.providerMessageId,
          "resend-session-006",
        ),
      )
      .orderBy(asc(identityEmailDeliveries.providerCreatedAt)),
  ).resolves.toEqual([
    {
      state: "sent",
      providerCreatedAt: new Date("2026-07-24T00:00:05.000Z"),
    },
    {
      state: "delivered",
      providerCreatedAt: new Date("2026-07-24T00:00:10.000Z"),
    },
  ]);
});

it("keeps application, email-worker, and maintenance privileges distinct", async () => {
  const seeded = await seedOutbox(1);
  await expect(
    appClient.query(
      "update identity_email_outbox set state = 'dead_letter', encrypted_payload = null where id = $1",
      [seeded[0].id],
    ),
  ).rejects.toThrow();

  const privilege = await owner.pool.query<{
    worker_update: boolean;
    worker_audit_update: boolean;
    app_delivery_insert: boolean;
    maintenance_delivery_delete: boolean;
  }>(`
    select
      has_table_privilege(
        'learning_hub_identity_email_worker',
        'identity_email_outbox',
        'UPDATE'
      ) as worker_update,
      has_table_privilege(
        'learning_hub_identity_email_worker',
        'identity_audit_events',
        'UPDATE'
      ) as worker_audit_update,
      has_table_privilege(
        'learning_hub_app',
        'identity_email_deliveries',
        'INSERT'
      ) as app_delivery_insert,
      has_table_privilege(
        'learning_hub_identity_maintenance',
        'identity_email_deliveries',
        'DELETE'
      ) as maintenance_delivery_delete
  `);
  expect(privilege.rows[0]).toEqual({
    worker_update: true,
    worker_audit_update: false,
    app_delivery_insert: false,
    maintenance_delivery_delete: true,
  });
});
