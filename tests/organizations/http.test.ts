import { describe, expect, it, vi } from "vitest";

import { AuthenticationRequiredError } from "@/modules/identity";
import {
  createOrganizationHttpHandlers,
  projectOrganizationWorkspace,
  toOrganizationWorkspaceServerState,
} from "@/modules/organizations/http";
import type { Actor } from "@/modules/identity";

const actor: Actor = {
  accountId: "00000000-0000-4000-8000-000000000001",
  accountStatus: "active",
  emailVerified: true,
  sessionId: "00000000-0000-4000-8000-000000000002",
  sessionFresh: true,
  mfaState: "not_enabled",
  globalRoles: [],
};

const organizationId = "00000000-0000-4000-8000-000000000003";

function service() {
  return {
    createOrganization: vi.fn(async () => ({
      ok: true as const,
      value: {
        organization: {
          id: organizationId,
          displayName: "สถาบันทดสอบ",
          slug: "test-academy",
          description: null,
          contactEmail: "owner@example.test",
          locale: "th-TH" as const,
          timeZone: "Asia/Bangkok",
          status: "active" as const,
          version: 1,
        },
        membership: { organizationId, accountId: actor.accountId, role: "owner" as const, status: "active" as const },
      },
    })),
    listOrganizationsForActor: vi.fn(async () => ({ ok: true as const, value: [] })),
    getOrganizationWorkspace: vi.fn(async () => ({ ok: false as const, error: { code: "forbidden" as const } })),
    updateOrganizationIdentity: vi.fn(async () => ({ ok: false as const, error: { code: "stale_version" as const } })),
  };
}

const jsonRequest = (url: string, body: unknown, origin = "https://learning.example.test") =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });

describe("organization HTTP boundary", () => {
  it("fails closed before authentication for cross-origin mutations", async () => {
    const create = service();
    const requireActor = vi.fn(async () => actor);
    const handlers = createOrganizationHttpHandlers({ service: create, requireActor, trustedOrigin: "https://learning.example.test" });

    const response = await handlers.createOrganization(
      jsonRequest("https://learning.example.test/api/organizations", {}, "https://attacker.invalid"),
    );

    expect(response.status).toBe(403);
    expect(requireActor).not.toHaveBeenCalled();
    expect(create.createOrganization).not.toHaveBeenCalled();
  });

  it("maps unauthenticated, invalid and duplicate-slug create attempts safely", async () => {
    const unauthenticated = createOrganizationHttpHandlers({
      service: service(),
      requireActor: vi.fn(async () => { throw new AuthenticationRequiredError(); }),
      trustedOrigin: "https://learning.example.test",
    });
    expect((await unauthenticated.listOrganizations(new Request("https://learning.example.test/api/organizations"))).status).toBe(401);

    const invalidService = service();
    const handlers = createOrganizationHttpHandlers({ service: invalidService, requireActor: vi.fn(async () => actor), trustedOrigin: "https://learning.example.test" });
    const invalid = await handlers.createOrganization(jsonRequest("https://learning.example.test/api/organizations", { slug: 42 }));
    expect(invalid.status).toBe(400);
    expect(invalidService.createOrganization).not.toHaveBeenCalled();

    invalidService.createOrganization.mockResolvedValueOnce({ ok: false, error: { code: "slug_taken", field: "slug" } } as never);
    const duplicate = await handlers.createOrganization(jsonRequest("https://learning.example.test/api/organizations", {
      displayName: "สถาบันทดสอบ", slug: "test-academy", description: "", contactEmail: "owner@example.test", locale: "th-TH", timeZone: "Asia/Bangkok",
    }));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ fieldErrors: { slug: expect.any(String) } });
  });

  it("maps only explicit authentication-required failures to 401 and preserves unexpected dependency failures as retryable 500", async () => {
    const unauthenticated = createOrganizationHttpHandlers({
      service: service(),
      requireActor: vi.fn(async () => { throw new AuthenticationRequiredError(); }),
      trustedOrigin: "https://learning.example.test",
    });
    expect((await unauthenticated.listOrganizations(new Request("https://learning.example.test/api/organizations"))).status).toBe(401);

    const unavailable = createOrganizationHttpHandlers({
      service: service(),
      requireActor: vi.fn(async () => { throw new Error("database unavailable"); }),
      trustedOrigin: "https://learning.example.test",
    });
    const response = await unavailable.listOrganizations(new Request("https://learning.example.test/api/organizations"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: false, message: "ไม่สามารถโหลดองค์กรได้ในขณะนี้" });
  });

  it("returns a safe create response and maps forbidden read plus stale update", async () => {
    const create = service();
    const handlers = createOrganizationHttpHandlers({ service: create, requireActor: vi.fn(async () => actor), trustedOrigin: "https://learning.example.test" });
    const created = await handlers.createOrganization(jsonRequest("https://learning.example.test/api/organizations", {
      displayName: "สถาบันทดสอบ", slug: "test-academy", contactEmail: "owner@example.test", locale: "th-TH", timeZone: "Asia/Bangkok",
    }));
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ organization: { id: organizationId, slug: "test-academy" } });

    const forbidden = await handlers.getOrganization(new Request(`https://learning.example.test/api/organizations/${organizationId}`), organizationId);
    expect(forbidden.status).toBe(403);

    const stale = await handlers.updateOrganization(new Request(`https://learning.example.test/api/organizations/${organizationId}`, {
      method: "PATCH", headers: { "content-type": "application/json", origin: "https://learning.example.test" },
      body: JSON.stringify({ displayName: "ชื่อใหม่", description: null, contactEmail: "owner@example.test", locale: "th-TH", timeZone: "Asia/Bangkok", expectedVersion: 1 }),
    }), organizationId);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "stale_version" });
  });

  it("returns a safe 500 when listing organizations throws", async () => {
    const create = service();
    create.listOrganizationsForActor.mockRejectedValueOnce(new Error("database unavailable"));
    const handlers = createOrganizationHttpHandlers({ service: create, requireActor: vi.fn(async () => actor), trustedOrigin: "https://learning.example.test" });

    const response = await handlers.listOrganizations(new Request("https://learning.example.test/api/organizations"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: false, message: "ไม่สามารถโหลดองค์กรได้ในขณะนี้" });
  });

  it("redacts contact email from a read-only member workspace response", async () => {
    const create = service();
    create.getOrganizationWorkspace.mockResolvedValueOnce({
      ok: true,
      value: {
        organization: {
          id: organizationId,
          displayName: "สถาบันทดสอบ",
          slug: "test-academy",
          description: null,
          contactEmail: "owner@example.test",
          locale: "th-TH",
          timeZone: "Asia/Bangkok",
          status: "active",
          version: 1,
        },
        membership: { organizationId, accountId: actor.accountId, role: "member", status: "active" },
      },
    } as never);
    const handlers = createOrganizationHttpHandlers({ service: create, requireActor: vi.fn(async () => actor), trustedOrigin: "https://learning.example.test" });

    const response = await handlers.getOrganization(new Request(`https://learning.example.test/api/organizations/${organizationId}`), organizationId);

    expect(response.status).toBe(200);
    expect((await response.json()).organization).not.toHaveProperty("contactEmail");
  });

  it("uses the same safe workspace projection for HTTP and server reads", async () => {
    const workspace = {
      organization: {
        id: organizationId,
        displayName: "สถาบันทดสอบ",
        slug: "test-academy",
        description: null,
        contactEmail: "owner@example.test",
        locale: "th-TH" as const,
        timeZone: "Asia/Bangkok",
        status: "active" as const,
        version: 1,
      },
      membership: { organizationId, accountId: actor.accountId, role: "member" as const, status: "active" as const },
    };
    const member = projectOrganizationWorkspace(workspace);
    expect(member.organization).not.toHaveProperty("contactEmail");
    const serverMember = toOrganizationWorkspaceServerState(workspace);
    expect(serverMember).toMatchObject({ kind: "success" });
    if (serverMember.kind === "success") expect(serverMember.workspace.organization).not.toHaveProperty("contactEmail");

    const manager = projectOrganizationWorkspace({
      ...workspace,
      membership: { ...workspace.membership, role: "manager" as const },
    });
    expect(manager.organization).toHaveProperty("contactEmail", "owner@example.test");
    const serverManager = toOrganizationWorkspaceServerState({
      ...workspace,
      membership: { ...workspace.membership, role: "manager" },
    });
    if (serverManager.kind === "success") expect(serverManager.workspace.organization).toHaveProperty("contactEmail", "owner@example.test");
  });
});
