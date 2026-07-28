import type { Actor } from "@/modules/identity";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationRepository } from "@/modules/organizations/repository";
import { createOrganizationService } from "@/modules/organizations/service";

const actor: Actor = {
  accountId: "00000000-0000-4000-8000-000000000001",
  accountStatus: "active",
  emailVerified: true,
  sessionId: "00000000-0000-4000-8000-000000000002",
  sessionFresh: true,
  mfaState: "verified",
  globalRoles: [],
};

const command = {
  displayName: "Learning School",
  slug: "learning-school",
  description: "Organization for learning",
  contactEmail: "Contact@Example.Test",
  locale: "th-TH" as const,
  timeZone: "Asia/Bangkok",
};

function repository(): OrganizationRepository {
  return {
    createOrganization: vi.fn(async (_tx, input) => ({
      id: "00000000-0000-4000-8000-000000000010",
      ...input,
      status: "active" as const,
      version: 1,
    })),
    createMembership: vi.fn(async () => undefined),
    appendAudit: vi.fn(async () => undefined),
    listForAccount: vi.fn(async () => []),
    findOrganizationById: vi.fn(async () => null),
    findActiveMembership: vi.fn(async () => null),
    updateOrganizationIdentity: vi.fn(async () => null),
  };
}

function database() {
  return {
    transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({})),
  };
}

describe("organization service", () => {
  it("creates organization, owner membership, redacted audit and event in one transaction", async () => {
    const store = repository();
    const emitted: unknown[] = [];
    const enqueueEvent = async (_transaction: unknown, input: unknown) => {
      emitted.push(input);
      return "event-id";
    };
    const service = createOrganizationService(database() as never, store, {
      enqueueEvent,
    });

    await expect(service.createOrganization(actor, command)).resolves.toMatchObject({
      ok: true,
      value: {
        organization: { slug: "learning-school", contactEmail: "contact@example.test" },
        membership: { role: "owner", status: "active" },
      },
    });
    expect(store.createMembership).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: actor.accountId, role: "owner", status: "active" }),
    );
    expect(store.appendAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "organization.created.v1",
        payload: { slug: "learning-school" },
      }),
    );
    expect(emitted).toEqual([
      expect.objectContaining({
        eventType: "organization.created.v1",
        payload: expect.not.objectContaining({ contactEmail: expect.anything() }),
      }),
    ]);
    expect(JSON.stringify(vi.mocked(store.appendAudit).mock.calls[0]![1])).not.toContain(
      "contact@example.test",
    );
    expect(JSON.stringify(emitted[0])).not.toContain(
      "contact@example.test",
    );
  });

  it("denies suspended actors before persistence", async () => {
    const store = repository();
    const service = createOrganizationService(database() as never, store);

    await expect(
      service.createOrganization({ ...actor, accountStatus: "suspended" }, command),
    ).resolves.toEqual({ ok: false, error: { code: "forbidden" } });
    expect(store.createOrganization).not.toHaveBeenCalled();
  });

  it("denies a suspended actor before reading a workspace", async () => {
    const store = repository();
    const service = createOrganizationService(database() as never, store);

    await expect(
      service.getOrganizationWorkspace(
        { ...actor, accountStatus: "suspended" },
        "00000000-0000-4000-8000-000000000010",
      ),
    ).resolves.toEqual({ ok: false, error: { code: "forbidden" } });
    expect(store.findOrganizationById).not.toHaveBeenCalled();
    expect(store.findActiveMembership).not.toHaveBeenCalled();
  });

  it("returns the stable stale-version error instead of overwriting", async () => {
    const store = repository();
    vi.mocked(store.findActiveMembership).mockResolvedValue({
      organizationId: "00000000-0000-4000-8000-000000000010",
      accountId: actor.accountId,
      role: "owner",
      status: "active",
    });
    vi.mocked(store.findOrganizationById).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000010",
      displayName: "Learning School",
      slug: "learning-school",
      description: null,
      contactEmail: "contact@example.test",
      locale: "th-TH",
      timeZone: "Asia/Bangkok",
      status: "active",
      version: 1,
    });
    vi.mocked(store.updateOrganizationIdentity).mockResolvedValue(null);
    const service = createOrganizationService(database() as never, store);

    await expect(
      service.updateOrganizationIdentity(actor, {
        organizationId: "00000000-0000-4000-8000-000000000010",
        displayName: "Learning School Updated",
        description: null,
        contactEmail: "contact@example.test",
        locale: "en-US",
        timeZone: "Asia/Bangkok",
        expectedVersion: 1,
      }),
    ).resolves.toEqual({ ok: false, error: { code: "stale_version" } });
  });

  it("maps only the organization slug unique conflict to a field error", async () => {
    const store = repository();
    vi.mocked(store.createOrganization).mockRejectedValue(
      Object.assign(new Error("duplicate slug"), {
        code: "23505",
        constraint: "organizations_slug_unique",
      }),
    );
    const service = createOrganizationService(database() as never, store, {
      enqueueEvent: vi.fn(async () => "event-id"),
    });

    await expect(service.createOrganization(actor, command)).resolves.toEqual({
      ok: false,
      error: { code: "slug_taken", field: "slug" },
    });
  });
});
