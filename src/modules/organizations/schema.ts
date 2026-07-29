import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  OrganizationLocale,
  OrganizationMembershipRole,
  OrganizationMembershipStatus,
  OrganizationStatus,
} from "./contracts";

const utcTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    contactEmail: text("contact_email").notNull(),
    locale: text("locale").$type<OrganizationLocale>().notNull(),
    timeZone: text("time_zone").notNull(),
    status: text("status").$type<OrganizationStatus>().default("active").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(table.slug),
    check("organizations_slug_check", sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'`),
    check(
      "organizations_display_name_length_check",
      sql`char_length(${table.displayName}) between 2 and 160`,
    ),
    check(
      "organizations_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) <= 1000`,
    ),
    check("organizations_contact_email_lowercase", sql`${table.contactEmail} = lower(${table.contactEmail})`),
    check("organizations_locale_check", sql`${table.locale} in ('th-TH','en-US')`),
    check("organizations_time_zone_check", sql`char_length(${table.timeZone}) between 1 and 128`),
    check("organizations_status_check", sql`${table.status} in ('active','suspended')`),
    check("organizations_version_check", sql`${table.version} >= 1`),
  ],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    // Account UUIDs are an external Identity contract. The organizations module
    // intentionally does not import Identity persistence to enforce a cross-module FK.
    accountId: uuid("account_id").notNull(),
    role: text("role").$type<OrganizationMembershipRole>().notNull(),
    status: text("status").$type<OrganizationMembershipStatus>().default("active").notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    removedAt: utcTimestamp("removed_at"),
  },
  (table) => [
    index("organization_memberships_organization_idx").on(
      table.organizationId,
      table.status,
    ),
    index("organization_memberships_account_idx").on(table.accountId, table.status),
    uniqueIndex("organization_memberships_active_account_unique")
      .on(table.organizationId, table.accountId)
      .where(sql`${table.status} = 'active'`),
    check("organization_memberships_role_check", sql`${table.role} in ('owner','manager','member')`),
    check("organization_memberships_status_check", sql`${table.status} in ('active','removed')`),
    check(
      "organization_memberships_removal_check",
      sql`(${table.status} = 'active' and ${table.removedAt} is null) or (${table.status} = 'removed' and ${table.removedAt} is not null)`,
    ),
  ],
);

export const organizationAuditEvents = pgTable(
  "organization_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    occurredAt: utcTimestamp("occurred_at").notNull(),
  },
  (table) => [
    index("organization_audit_events_organization_time_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
  ],
);
