import { describe, expect, it, vi } from "vitest";

import {
  createIdentityAdminHttpHandlers,
  parseExactAccountLookup,
  type IdentityAdministrationPort,
} from "@/modules/identity/admin-http";
import type { Actor } from "@/modules/identity";

const actor = (roles: Actor["globalRoles"]): Actor => ({
  accountId: "00000000-0000-4000-8000-000000000001",
  accountStatus: "active",
  emailVerified: true,
  sessionId: "00000000-0000-4000-8000-000000000002",
  sessionFresh: true,
  mfaState: "verified",
  globalRoles: roles,
});

function administration(): IdentityAdministrationPort {
  return {
    searchAccounts: vi.fn(async () => []),
    getSupportAccount: vi.fn(async () => ({
      accountId: "00000000-0000-4000-8000-000000000099",
      displayName: "ผู้ใช้ทดสอบ",
      status: "active",
      emailVerified: true,
      twoFactorEnabled: true,
    })),
    getAdminAccount: vi.fn(async () => ({
      accountId: "00000000-0000-4000-8000-000000000099",
      displayName: "ผู้ใช้ทดสอบ",
      email: "person@example.com",
      status: "active",
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: "2026-07-24T00:00:00.000Z",
      activeGlobalRoles: [],
    })),
    getAccountAudit: vi.fn(async () => []),
    revokeAccountSessions: vi.fn(async () => ({ revokedCount: 1 })),
    suspendAccount: vi.fn(async () => ({ status: "suspended" as const })),
    reactivateAccount: vi.fn(async () => ({ status: "active" as const })),
    grantGlobalRole: vi.fn(async () => ({
      grantId: "00000000-0000-4000-8000-000000000088",
    })),
    revokeGlobalRole: vi.fn(async () => ({
      grantId: "00000000-0000-4000-8000-000000000088",
    })),
  };
}

describe("SESSION-006 admin identity HTTP boundary", () => {
  it("accepts only an exact UUID or an already-normalized exact email", () => {
    expect(
      parseExactAccountLookup("00000000-0000-4000-8000-000000000099"),
    ).toEqual({
      kind: "account_id",
      value: "00000000-0000-4000-8000-000000000099",
    });
    expect(parseExactAccountLookup("person@example.com")).toEqual({
      kind: "email",
      value: "person@example.com",
    });
    for (const invalid of [
      "Person@Example.com",
      " person@example.com ",
      "person",
      "00000000-0000-0000-0000-000000000099",
    ]) {
      expect(() => parseExactAccountLookup(invalid)).toThrow(
        "exact account lookup is invalid",
      );
    }
  });

  it("returns the minimal support DTO and never calls the admin read", async () => {
    const admin = administration();
    const handlers = createIdentityAdminHttpHandlers({
      authenticate: vi.fn(async () => actor(["support_operator"])),
      administration: admin,
      trustedOrigin: "https://example.test",
    });

    const response = await handlers.getAccount(
      new Request("https://example.test/api/admin/identity/accounts/target"),
      "00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("account.email");
    expect(admin.getSupportAccount).toHaveBeenCalledOnce();
    expect(admin.getAdminAccount).not.toHaveBeenCalled();
  });

  it("uses the admin DTO only for a current platform admin", async () => {
    const admin = administration();
    const handlers = createIdentityAdminHttpHandlers({
      authenticate: vi.fn(async () => actor(["platform_admin"])),
      administration: admin,
      trustedOrigin: "https://example.test",
    });

    const response = await handlers.getAccount(
      new Request("https://example.test/api/admin/identity/accounts/target"),
      "00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      account: { email: "person@example.com" },
      capabilities: {
        canManageLifecycle: true,
        canManageRoles: true,
        canRevokeSessions: false,
      },
    });
    expect(admin.getAdminAccount).toHaveBeenCalledOnce();
  });

  it("fails closed before invoking administration when no actor exists", async () => {
    const admin = administration();
    const handlers = createIdentityAdminHttpHandlers({
      authenticate: vi.fn(async () => null),
      administration: admin,
      trustedOrigin: "https://example.test",
    });

    const response = await handlers.searchAccounts(
      new Request(
        "https://example.test/api/admin/identity/accounts?query=person%40example.com",
      ),
    );

    expect(response.status).toBe(401);
    expect(admin.searchAccounts).not.toHaveBeenCalled();
  });

  it("validates mutation actions and reason codes at the route boundary", async () => {
    const admin = administration();
    const handlers = createIdentityAdminHttpHandlers({
      authenticate: vi.fn(async () => actor(["platform_admin"])),
      administration: admin,
      trustedOrigin: "https://example.test",
    });

    const invalid = await handlers.mutateAccount(
      new Request("https://example.test/api/admin/identity/accounts/target", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://example.test",
        },
        body: JSON.stringify({
          action: "suspend",
          reasonCode: "contains spaces",
        }),
      }),
      "00000000-0000-4000-8000-000000000099",
    );

    expect(invalid.status).toBe(400);
    expect(admin.suspendAccount).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations before authentication or JSON parsing", async () => {
    const admin = administration();
    const authenticate = vi.fn(async () => actor(["platform_admin"]));
    const handlers = createIdentityAdminHttpHandlers({
      authenticate,
      administration: admin,
      trustedOrigin: "https://example.test",
    });

    const response = await handlers.mutateAccount(
      new Request("https://example.test/api/admin/identity/accounts/target", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.invalid",
        },
        body: "{}",
      }),
      "00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
