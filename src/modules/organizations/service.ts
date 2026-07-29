import type { Actor } from "@/modules/identity";
import type { AppDatabase } from "@/platform/database/client";
import { withTransaction } from "@/platform/database/transaction";
import { enqueueDomainEvent } from "@/platform/events";

import type {
  CreateOrganizationCommand,
  OrganizationError,
  OrganizationMembership,
  OrganizationSummaryDto,
  UpdateOrganizationIdentityCommand,
} from "./contracts";
import {
  evaluateOrganizationAuthorization,
  isValidOrganizationSlug,
  normalizeOrganizationSlug,
} from "./domain";
import {
  createOrganizationRepository,
  type OrganizationRepository,
  type StoredOrganization,
} from "./repository";

export type OrganizationWorkspaceDto = {
  organization: OrganizationSummaryDto & { contactEmail: string; version: number };
  membership: OrganizationMembership;
};

export type OrganizationOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OrganizationError };

export type OrganizationServiceDependencies = {
  enqueueEvent?: typeof enqueueDomainEvent;
  now?: () => Date;
};

function invalid(field: OrganizationError["field"]): OrganizationOperationResult<never> {
  return { ok: false, error: { code: "invalid_input", field } };
}

function toSummary(organization: StoredOrganization): OrganizationSummaryDto {
  return {
    id: organization.id,
    displayName: organization.displayName,
    slug: organization.slug,
    description: organization.description,
    locale: organization.locale,
    timeZone: organization.timeZone,
    status: organization.status,
  };
}

function toWorkspace(
  organization: StoredOrganization,
  membership: OrganizationMembership,
): OrganizationWorkspaceDto {
  return {
    organization: {
      ...toSummary(organization),
      contactEmail: organization.contactEmail,
      version: organization.version,
    },
    membership,
  };
}

function normalizeIdentity(input: {
  displayName: string;
  description?: string | null;
  contactEmail: string;
  locale: CreateOrganizationCommand["locale"];
  timeZone: string;
}) {
  return {
    displayName: input.displayName.trim(),
    description: input.description?.trim() || null,
    contactEmail: input.contactEmail.trim().toLowerCase(),
    locale: input.locale,
    timeZone: input.timeZone.trim(),
  };
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validateIdentity(input: ReturnType<typeof normalizeIdentity>) {
  if (input.displayName.length < 2 || input.displayName.length > 160) {
    return invalid("displayName");
  }
  if (input.description && input.description.length > 1000) return invalid("description");
  if (!validEmail(input.contactEmail)) return invalid("contactEmail");
  if (input.locale !== "th-TH" && input.locale !== "en-US") return invalid("locale");
  if (!validTimeZone(input.timeZone)) return invalid("timeZone");
  return null;
}

function isSlugConflict(error: unknown): boolean {
  let current = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (candidate.code === "23505" && candidate.constraint === "organizations_slug_unique") {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

function serviceActor(actor: Actor) {
  return { accountId: actor.accountId, accountStatus: actor.accountStatus };
}

export function createOrganizationService(
  database: AppDatabase,
  repository: OrganizationRepository = createOrganizationRepository(database),
  dependencies: OrganizationServiceDependencies = {},
) {
  const now = dependencies.now ?? (() => new Date());
  const enqueueEvent = dependencies.enqueueEvent ?? enqueueDomainEvent;

  return {
    async createOrganization(
      actor: Actor,
      command: CreateOrganizationCommand,
    ): Promise<OrganizationOperationResult<OrganizationWorkspaceDto>> {
      if (!evaluateOrganizationAuthorization({ actor: serviceActor(actor), permission: "organization.create" }).allowed) {
        return { ok: false, error: { code: "forbidden" } };
      }
      const slug = normalizeOrganizationSlug(command.slug);
      if (!isValidOrganizationSlug(slug)) return invalid("slug");
      const identity = normalizeIdentity(command);
      const identityError = validateIdentity(identity);
      if (identityError) return identityError;

      try {
        return await withTransaction(database, async (transaction) => {
          const organization = await repository.createOrganization(transaction, {
            ...identity,
            slug,
          });
          const membership: OrganizationMembership = {
            organizationId: organization.id,
            accountId: actor.accountId,
            role: "owner",
            status: "active",
          };
          await repository.createMembership(transaction, membership);
          await repository.appendAudit(transaction, {
            organizationId: organization.id,
            actorAccountId: actor.accountId,
            action: "organization.created.v1",
            payload: { slug: organization.slug },
            occurredAt: now(),
          });
          await enqueueEvent(transaction, {
            eventType: "organization.created.v1",
            aggregateType: "organization",
            aggregateId: organization.id,
            payload: {
              organizationId: organization.id,
              ownerAccountId: actor.accountId,
              slug: organization.slug,
            },
            occurredAt: now(),
          });
          return { ok: true, value: toWorkspace(organization, membership) };
        });
      } catch (error) {
        if (isSlugConflict(error)) return { ok: false, error: { code: "slug_taken", field: "slug" } };
        throw error;
      }
    },

    async listOrganizationsForActor(
      actor: Actor,
    ): Promise<OrganizationOperationResult<OrganizationSummaryDto[]>> {
      if (!evaluateOrganizationAuthorization({ actor: serviceActor(actor), permission: "organization.create" }).allowed) {
        return { ok: false, error: { code: "forbidden" } };
      }
      const organizations = await repository.listForAccount(actor.accountId);
      return { ok: true, value: organizations.map(toSummary) };
    },

    async getOrganizationWorkspace(
      actor: Actor,
      organizationId: string,
    ): Promise<OrganizationOperationResult<OrganizationWorkspaceDto>> {
      if (actor.accountStatus !== "active") {
        return { ok: false, error: { code: "forbidden" } };
      }
      const [organization, membership] = await Promise.all([
        repository.findOrganizationById(organizationId),
        repository.findActiveMembership(organizationId, actor.accountId),
      ]);
      if (!organization) return { ok: false, error: { code: "organization_not_found" } };
      const decision = evaluateOrganizationAuthorization({
        actor: serviceActor(actor),
        permission: "organization.workspace.read",
        organizationId,
        membership: membership ?? undefined,
      });
      if (!decision.allowed || organization.status !== "active" || !membership) {
        return { ok: false, error: { code: "forbidden" } };
      }
      return { ok: true, value: toWorkspace(organization, membership) };
    },

    async updateOrganizationIdentity(
      actor: Actor,
      command: UpdateOrganizationIdentityCommand,
    ): Promise<OrganizationOperationResult<OrganizationWorkspaceDto>> {
      if (actor.accountStatus !== "active") {
        return { ok: false, error: { code: "forbidden" } };
      }
      if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 1) {
        return invalid("expectedVersion");
      }
      const identity = normalizeIdentity(command);
      const identityError = validateIdentity(identity);
      if (identityError) return identityError;

      const updateResult = await withTransaction(database, async (transaction) => {
        const organization = await repository.lockOrganizationForUpdate(
          transaction,
          command.organizationId,
        );
        if (!organization) return { kind: "not_found" as const };
        // Organization is the aggregate serialization lock. Membership writers
        // must hold it before changing roles/status, so this read sees their
        // committed state without granting the app role membership UPDATE.
        const membership = await repository.readActiveMembershipUnderOrganizationLock(
          transaction,
          command.organizationId,
          actor.accountId,
        );
        const decision = evaluateOrganizationAuthorization({
          actor: serviceActor(actor),
          permission: "organization.identity.update",
          organizationId: command.organizationId,
          membership: membership ?? undefined,
        });
        if (!decision.allowed || organization.status !== "active" || !membership) {
          return { kind: "forbidden" as const };
        }
        const record = await repository.updateOrganizationIdentity(transaction, {
          id: command.organizationId,
          ...identity,
          version: command.expectedVersion,
        });
        if (!record) return { kind: "stale" as const };
        await repository.appendAudit(transaction, {
          organizationId: record.id,
          actorAccountId: actor.accountId,
          action: "organization.identity_updated.v1",
          payload: { fields: "display_name,description,locale,time_zone" },
          occurredAt: now(),
        });
        return { kind: "updated" as const, record, membership };
      });
      if (updateResult.kind === "not_found") return { ok: false, error: { code: "organization_not_found" } };
      if (updateResult.kind === "forbidden") return { ok: false, error: { code: "forbidden" } };
      if (updateResult.kind === "stale") return { ok: false, error: { code: "stale_version" } };
      return { ok: true, value: toWorkspace(updateResult.record, updateResult.membership) };
    },
  };
}
