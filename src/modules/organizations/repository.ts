import { and, desc, eq } from "drizzle-orm";

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
  lockActiveMembershipForUpdate(
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
      const rows = await transaction
        .insert(organizations)
        .values(input)
        .returning(organizationSelection);
      if (!rows[0]) throw new Error("organization create returned no row");
      return rows[0];
    },

    async createMembership(transaction, input) {
      await transaction.insert(organizationMemberships).values(input);
    },

    async appendAudit(transaction, input) {
      await transaction.insert(organizationAuditEvents).values(input);
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

    async lockActiveMembershipForUpdate(transaction, organizationId, accountId) {
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
        )
        .for("update");
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
