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
    name: text("name"),
    email: text("email"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
    status: text("status").default("pending_verification").notNull(),
    ageAttestedAt: utcTimestamp("age_attested_at").notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    closedAt: utcTimestamp("closed_at"),
  },
  (table) => [
    uniqueIndex("identity_accounts_email_unique").on(table.email),
    check("identity_accounts_email_lowercase", sql`${table.email} = lower(${table.email})`),
    check(
      "identity_accounts_status_check",
      sql`${table.status} in ('pending_verification','active','suspended','deletion_scheduled','closed')`,
    ),
    check(
      "identity_accounts_closed_pii_check",
      sql`(${table.status} = 'closed' and ${table.email} is null and ${table.name} is null and ${table.closedAt} is not null) or (${table.status} <> 'closed' and ${table.email} is not null and ${table.name} is not null and ${table.closedAt} is null)`,
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
    mfaVerifiedAt: utcTimestamp("mfa_verified_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "cascade" }),
  },
  (table) => [index("identity_sessions_user_id_idx").on(table.userId)],
);

export const globalRoleValues = [
  "reviewer",
  "support_operator",
  "finance_operator",
  "platform_admin",
] as const;

export type GlobalRole = (typeof globalRoleValues)[number];

export const identityGlobalRoleGrants = pgTable(
  "identity_global_role_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "restrict" }),
    role: text("role").$type<GlobalRole>().notNull(),
    grantedByAccountId: uuid("granted_by_account_id").references(
      () => identityAccounts.id,
      { onDelete: "restrict" },
    ),
    revokedByAccountId: uuid("revoked_by_account_id").references(
      () => identityAccounts.id,
      { onDelete: "restrict" },
    ),
    reasonCode: text("reason_code").notNull(),
    startsAt: utcTimestamp("starts_at").defaultNow().notNull(),
    expiresAt: utcTimestamp("expires_at"),
    grantedAt: utcTimestamp("granted_at").defaultNow().notNull(),
    revokedAt: utcTimestamp("revoked_at"),
  },
  (table) => [
    index("identity_global_role_grants_account_idx").on(
      table.accountId,
      table.startsAt,
    ),
    uniqueIndex("identity_global_role_grants_unrevoked_unique")
      .on(table.accountId, table.role)
      .where(sql`${table.revokedAt} is null`),
    check(
      "identity_global_role_grants_role_check",
      sql`${table.role} in ('reviewer','support_operator','finance_operator','platform_admin')`,
    ),
    check(
      "identity_global_role_grants_timeline_check",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.startsAt}`,
    ),
    check(
      "identity_global_role_grants_revocation_check",
      sql`(${table.revokedAt} is null and ${table.revokedByAccountId} is null) or (${table.revokedAt} is not null and ${table.revokedByAccountId} is not null)`,
    ),
  ],
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

export const identityTwoFactors = pgTable(
  "identity_two_factors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").default(false).notNull(),
    failedVerificationCount: integer("failed_verification_count")
      .default(0)
      .notNull(),
    lockedUntil: utcTimestamp("locked_until"),
  },
  (table) => [
    uniqueIndex("identity_two_factors_user_id_unique").on(table.userId),
    check(
      "identity_two_factors_failed_count_check",
      sql`${table.failedVerificationCount} >= 0`,
    ),
  ],
);

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
    actorType: text("actor_type").default("account").notNull(),
    actorAccountId: uuid("actor_account_id").references(
      () => identityAccounts.id,
      { onDelete: "restrict" },
    ),
    action: text("action").notNull(),
    reasonCode: text("reason_code"),
    correlationId: text("correlation_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    occurredAt: utcTimestamp("occurred_at").notNull(),
  },
  (table) => [
    index("identity_audit_account_time_idx").on(
      table.accountId,
      table.occurredAt,
    ),
    index("identity_audit_actor_time_idx").on(
      table.actorAccountId,
      table.occurredAt,
    ),
    check(
      "identity_audit_actor_check",
      sql`(${table.actorType} = 'account' and ${table.actorAccountId} is not null) or (${table.actorType} in ('system:bootstrap','system:break-glass','system:maintenance') and ${table.actorAccountId} is null)`,
    ),
  ],
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
    encryptedPayload: text("encrypted_payload"),
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

export const identityAccountDeletionRequests = pgTable(
  "identity_account_deletion_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => identityAccounts.id, { onDelete: "restrict" }),
    state: text("state").default("requested").notNull(),
    confirmationTokenHash: text("confirmation_token_hash"),
    confirmationExpiresAt: utcTimestamp("confirmation_expires_at"),
    requestedAt: utcTimestamp("requested_at").defaultNow().notNull(),
    confirmedAt: utcTimestamp("confirmed_at"),
    scheduledFor: utcTimestamp("scheduled_for"),
    cancelledAt: utcTimestamp("cancelled_at"),
    completedAt: utcTimestamp("completed_at"),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("identity_deletion_requests_account_idx").on(table.accountId),
    index("identity_deletion_requests_due_idx").on(table.state, table.scheduledFor),
    uniqueIndex("identity_deletion_requests_active_unique")
      .on(table.accountId)
      .where(sql`${table.state} in ('requested','confirmed','scheduled')`),
    check(
      "identity_deletion_requests_state_check",
      sql`${table.state} in ('requested','confirmed','scheduled','cancelled','completed','expired')`,
    ),
    check(
      "identity_deletion_requests_timeline_check",
      sql`(${table.state} = 'requested' and ${table.confirmationTokenHash} is not null and ${table.confirmationExpiresAt} is not null) or (${table.state} = 'scheduled' and ${table.confirmedAt} is not null and ${table.scheduledFor} is not null and ${table.confirmationTokenHash} is null) or (${table.state} = 'cancelled' and ${table.cancelledAt} is not null) or (${table.state} = 'completed' and ${table.completedAt} is not null) or ${table.state} in ('confirmed','expired')`,
    ),
  ],
);

export const betterAuthSchema = {
  user: identityAccounts,
  account: identityAuthFactors,
  session: identitySessions,
  verification: identityVerifications,
  rateLimit: identityRateLimits,
  twoFactor: identityTwoFactors,
};
