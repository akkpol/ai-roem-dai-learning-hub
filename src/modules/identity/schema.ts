import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  pgTable,
} from "drizzle-orm/pg-core";

const utcTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const identityAccounts = pgTable(
  "identity_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
    status: text("status").default("pending_verification").notNull(),
    ageAttestedAt: utcTimestamp("age_attested_at").notNull(),
  },
  (table) => [
    uniqueIndex("identity_accounts_email_unique").on(table.email),
    check("identity_accounts_email_lowercase", sql`${table.email} = lower(${table.email})`),
    check(
      "identity_accounts_status_check",
      sql`${table.status} in ('pending_verification','active','suspended','deletion_scheduled','closed')`,
    ),
  ],
);

export const identitySessions = pgTable(
  "identity_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "cascade" }),
  },
  (table) => [index("identity_sessions_user_id_idx").on(table.userId)],
);

export const identityAuthFactors = pgTable(
  "identity_auth_factors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: utcTimestamp("access_token_expires_at"),
    refreshTokenExpiresAt: utcTimestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("identity_auth_factors_user_id_idx").on(table.userId),
    uniqueIndex("identity_auth_factors_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const identityVerifications = pgTable(
  "identity_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("identity_verifications_identifier_idx").on(table.identifier),
    index("identity_verifications_value_idx").on(table.value),
  ],
);

export const identityRateLimits = pgTable("identity_rate_limits", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const identityProfiles = pgTable("identity_profiles", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => identityAccounts.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  locale: text("locale").default("th-TH").notNull(),
  timeZone: text("time_zone").default("Asia/Bangkok").notNull(),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
});

export const identityPolicyAcceptances = pgTable(
  "identity_policy_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "cascade" }),
    policyType: text("policy_type").notNull(),
    policyVersion: text("policy_version").notNull(),
    acceptedAt: utcTimestamp("accepted_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("identity_policy_acceptances_exact_unique").on(
      table.accountId,
      table.policyType,
      table.policyVersion,
    ),
  ],
);

export const identityAuditEvents = pgTable(
  "identity_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, string>>().notNull(),
    occurredAt: utcTimestamp("occurred_at").notNull(),
  },
  (table) => [index("identity_audit_account_time_idx").on(table.accountId, table.occurredAt)],
);

export const identityEmailOutbox = pgTable(
  "identity_email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "cascade" }),
    template: text("template").notNull(),
    recipientHash: text("recipient_hash").notNull(),
    encryptedPayload: text("encrypted_payload").notNull(),
    keyVersion: text("key_version").notNull(),
    idempotencyKey: uuid("idempotency_key").defaultRandom().notNull().unique(),
    state: text("state").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: utcTimestamp("next_attempt_at").defaultNow().notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("identity_email_outbox_dispatch_idx").on(table.state, table.nextAttemptAt),
    check(
      "identity_email_outbox_state_check",
      sql`${table.state} in ('pending','sending','sent','retry_wait','dead_letter','expired')`,
    ),
    check("identity_email_outbox_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);

export const betterAuthSchema = {
  user: identityAccounts,
  account: identityAuthFactors,
  session: identitySessions,
  verification: identityVerifications,
  rateLimit: identityRateLimits,
};
