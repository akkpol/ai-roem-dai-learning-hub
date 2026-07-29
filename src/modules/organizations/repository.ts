import { and, desc, eq, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "@/platform/database/transaction";
import type { AppDatabase } from "@/platform/database/client";

import type {
  OrganizationLocale,
  OrganizationMembership,
  OrganizationStatus,
} from "./contracts";
import {
  organizationAuditEvents,
  organizationMemberships,
  organizations,
} from "./schema";

export type StoredOrganization = {
  id: string;
  displayName: string;
  slug: string;
  description: string | null;
  contactEmail: string;
  locale: OrganizationLocale;
  timeZone: string;
  status: OrganizationStatus;
  version: number;
};

export type OrganizationRepository = {
  createOrganization(
    transaction: DatabaseTransaction,
    input: Omit<StoredOrganization, "id" | "status" | "version">,
  ): Promise<StoredOrganization>;
  createMembership(
    transaction: DatabaseTransaction,
    input: OrganizationMembership,
  ): Promise<void>;
  appendAudit(
    transaction: DatabaseTransaction,
    input: {
      organizationId: string;
      actorAccountId: string;
      action: string;
      payload: Record<string, unknown>;
      occurredAt: Date;
    },
  ): Promise<void>;
  listForAccount(accountId: string): Promise<StoredOrganization[]>;
  findOrganizationById(organizationId: string): Promise<StoredOrganization | null>;
  findActiveMembership(
    organizationId: string,
    accountId: string,
  ): Promise<OrganizationMembership | null>;
  lockOrganizationForUpdate(
    transaction: DatabaseTransaction,
    organizationId: string,
  ): Promise<StoredOrganization | null>;
  readActiveMembershipUnderOrganizationLock(
    transaction: DatabaseTransaction,
    organizationId: string,
    accountId: string,
  ): Promise<OrganizationMembership | null>;
  updateOrganizationIdentity(
    transaction: DatabaseTransaction,
    input: Pick<
      StoredOrganization,
      "id" | "displayName" | "description" | "contactEmail" | "locale" | "timeZone" | "version"
    >,
  ): Promise<StoredOrganization | null>;
};

const organizationSelection = {
  id: organizations.id,
  displayName: organizations.displayName,
  slug: organizations.slug,
  description: organizations.description,
  contactEmail: organizations.contactEmail,
  locale: organizations.locale,
  timeZone: organizations.timeZone,
  status: organizations.status,
  version: organizations.version,
};

export function createOrganizationRepository(database: AppDatabase): OrganizationRepository {
  return {
    async createOrganization(transaction, input) {
      const result = await transaction.execute<StoredOrganization>(sql`insert into ${organizations} (
    "display_name", "slug", "description", "contact_email", "locale", "time_zone"
  ) values (
    ${sql.param(input.displayName, organizations.displayName)},
    ${sql.param(input.slug, organizations.slug)},
    ${sql.param(input.description, organizations.description)},
    ${sql.param(input.contactEmail, organizations.contactEmail)},
    ${sql.param(input.locale, organizations.locale)},
    ${sql.param(input.timeZone, organizations.timeZone)}
  ) returning
    "id" as "id",
    "display_name" as "displayName",
    "slug" as "slug",
    "description" as "description",
    "contact_email" as "contactEmail",
    "locale" as "locale",
    "time_zone" as "timeZone",
    "status" as "status",
    "version" as "version"`);
      const organization = result.rows[0];
      if (!organization) throw new Error("organization create returned no row");
      return organization;
    },

    async createMembership(transaction, input) {
      await transaction.execute(sql`insert into ${organizationMemberships} (
    "organization_id", "account_id", "role", "status"
  ) values (
    ${sql.param(input.organizationId, organizationMemberships.organizationId)},
    ${sql.param(input.accountId, organizationMemberships.accountId)},
    ${sql.param(input.role, organizationMemberships.role)},
    ${sql.param(input.status, organizationMemberships.status)}
  )`);
    },

    async appendAudit(transaction, input) {
      await transaction.execute(sql`insert into ${organizationAuditEvents} (
    "organization_id", "actor_account_id", "action", "payload", "occurred_at"
  ) values (
    ${sql.param(input.organizationId, organizationAuditEvents.organizationId)},
    ${sql.param(input.actorAccountId, organizationAuditEvents.actorAccountId)},
    ${sql.param(input.action, organizationAuditEvents.action)},
    ${sql.param(input.payload, organizationAuditEvents.payload)},
    ${sql.param(input.occurredAt, organizationAuditEvents.occurredAt)}
  )`);
    },

    async listForAccount(accountId) {
      return database
        .select(organizationSelection)
        .from(organizations)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.accountId, accountId),
            eq(organizationMemberships.status, "active"),
          ),
        )
        .where(eq(organizations.status, "active"))
        .orderBy(desc(organizations.updatedAt));
    },

    async findOrganizationById(organizationId) {
      const rows = await database
        .select(organizationSelection)
        .from(organizations)
        .where(eq(organizations.id, organizationId));
      return rows[0] ?? null;
    },

    async findActiveMembership(organizationId, accountId) {
      const rows = await database
        .select({
          organizationId: organizationMemberships.organizationId,
          accountId: organizationMemberships.accountId,
          role: organizationMemberships.role,
          status: organizationMemberships.status,
        })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.accountId, accountId),
            eq(organizationMemberships.status, "active"),
          ),
        );
      return rows[0] ?? null;
    },

    async lockOrganizationForUpdate(transaction, organizationId) {
      const rows = await transaction
        .select(organizationSelection)
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .for("update");
      return rows[0] ?? null;
    },

    async readActiveMembershipUnderOrganizationLock(transaction, organizationId, accountId) {
      const rows = await transaction
        .select({
          organizationId: organizationMemberships.organizationId,
          accountId: organizationMemberships.accountId,
          role: organizationMemberships.role,
          status: organizationMemberships.status,
        })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.accountId, accountId),
            eq(organizationMemberships.status, "active"),
          ),
        );
      return rows[0] ?? null;
    },

    async updateOrganizationIdentity(transaction, input) {
      const rows = await transaction
        .update(organizations)
        .set({
          displayName: input.displayName,
          description: input.description,
          contactEmail: input.contactEmail,
          locale: input.locale,
          timeZone: input.timeZone,
          version: input.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizations.id, input.id),
            eq(organizations.version, input.version),
            eq(organizations.status, "active"),
          ),
        )
        .returning(organizationSelection);
      return rows[0] ?? null;
    },
  };
}
