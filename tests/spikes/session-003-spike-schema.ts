import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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
  },
  (table) => [
    uniqueIndex("identity_accounts_email_unique").on(table.email),
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
  },
  (table) => [
    uniqueIndex("identity_policy_acceptances_exact_unique").on(
      table.accountId,
      table.policyType,
      table.policyVersion,
    ),
  ],
);

export const identityAuditEvents = pgTable("identity_audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => identityAccounts.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  payload: jsonb("payload").$type<Record<string, string>>().notNull(),
  occurredAt: utcTimestamp("occurred_at").notNull(),
});

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
    state: text("state").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: utcTimestamp("next_attempt_at").defaultNow().notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("identity_email_outbox_dispatch_idx").on(
      table.state,
      table.nextAttemptAt,
    ),
  ],
);

export const session003SpikeSchema = {
  user: identityAccounts,
  session: identitySessions,
  account: identityAuthFactors,
  verification: identityVerifications,
  rateLimit: identityRateLimits,
};

export const session003SpikeDdl = sql.raw(`
  create table if not exists identity_accounts (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique check (email = lower(email)),
    email_verified boolean not null default false,
    image text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    status text not null default 'pending_verification'
  );
  create table if not exists identity_sessions (
    id uuid primary key default gen_random_uuid(),
    expires_at timestamptz not null,
    token text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    ip_address text,
    user_agent text,
    user_id uuid not null references identity_accounts(id) on delete cascade
  );
  create index if not exists identity_sessions_user_id_idx on identity_sessions(user_id);
  create table if not exists identity_auth_factors (
    id uuid primary key default gen_random_uuid(),
    account_id text not null,
    provider_id text not null,
    user_id uuid not null references identity_accounts(id) on delete cascade,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scope text,
    password text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(provider_id, account_id)
  );
  create index if not exists identity_auth_factors_user_id_idx on identity_auth_factors(user_id);
  create table if not exists identity_verifications (
    id uuid primary key default gen_random_uuid(),
    identifier text not null,
    value text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create index if not exists identity_verifications_identifier_idx on identity_verifications(identifier);
  create table if not exists identity_rate_limits (
    id uuid primary key default gen_random_uuid(),
    key text not null unique,
    count integer not null,
    last_request bigint not null
  );
  create table if not exists identity_profiles (
    account_id uuid primary key references identity_accounts(id) on delete cascade,
    display_name text not null,
    locale text not null default 'th-TH',
    time_zone text not null default 'Asia/Bangkok',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table if not exists identity_policy_acceptances (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references identity_accounts(id) on delete cascade,
    policy_type text not null,
    policy_version text not null,
    accepted_at timestamptz not null,
    unique(account_id, policy_type, policy_version)
  );
  create table if not exists identity_audit_events (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references identity_accounts(id) on delete restrict,
    action text not null,
    payload jsonb not null,
    occurred_at timestamptz not null
  );
  create table if not exists identity_email_outbox (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references identity_accounts(id) on delete cascade,
    template text not null,
    recipient_hash text not null,
    encrypted_payload text not null,
    key_version text not null,
    state text not null default 'pending',
    attempt_count integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    created_at timestamptz not null default now()
  );
  create index if not exists identity_email_outbox_dispatch_idx
    on identity_email_outbox(state, next_attempt_at);
`);
