import { describe, expect, it } from "vitest";

import {
  evaluateAuthorization,
  type Actor,
  type Permission,
} from "@/modules/identity/authorization";

const activeActor = (overrides: Partial<Actor> = {}): Actor => ({
  accountId: "00000000-0000-4000-8000-000000000001",
  accountStatus: "active",
  emailVerified: true,
  sessionId: "00000000-0000-4000-8000-000000000002",
  sessionFresh: true,
  mfaState: "verified",
  globalRoles: [],
  ...overrides,
});

function decision(
  actor: Actor,
  permission: Permission,
  targetAccountId?: string,
) {
  return evaluateAuthorization({ actor, permission, targetAccountId });
}

describe("SESSION-005 deny-by-default authorization matrix", () => {
  it("allows an active account to manage only its own identity resources", () => {
    const actor = activeActor();
    expect(decision(actor, "identity.profile.read", actor.accountId).allowed).toBe(true);
    expect(
      decision(
        actor,
        "identity.profile.read",
        "00000000-0000-4000-8000-000000000099",
      ),
    ).toMatchObject({ allowed: false, reason: "resource_ownership_required" });
  });

  it("requires freshness and any enrolled MFA for own security, export, and deletion actions", () => {
    const actor = activeActor();
    for (const permission of [
      "identity.security.manage",
      "identity.export.create",
      "identity.deletion.manage",
    ] as const) {
      expect(decision(actor, permission, actor.accountId)).toMatchObject({
        allowed: true,
        reason: "allowed",
      });
      expect(
        decision(
          { ...actor, sessionFresh: false },
          permission,
          actor.accountId,
        ),
      ).toMatchObject({
        allowed: false,
        reason: "fresh_session_required",
      });
      expect(
        decision(
          { ...actor, mfaState: "required" },
          permission,
          actor.accountId,
        ),
      ).toMatchObject({ allowed: false, reason: "mfa_required" });
      expect(
        decision(
          { ...actor, mfaState: "not_enabled" },
          permission,
          actor.accountId,
        ),
      ).toMatchObject({ allowed: true, reason: "allowed" });
    }
  });

  it("keeps ordinary own profile and device-session access independent of step-up", () => {
    const actor = activeActor({
      sessionFresh: false,
      mfaState: "required",
    });
    for (const permission of [
      "identity.profile.read",
      "identity.profile.update",
      "identity.sessions.manage",
    ] as const) {
      expect(decision(actor, permission, actor.accountId)).toMatchObject({
        allowed: true,
        reason: "allowed",
      });
    }
  });

  it("denies unknown permissions and inactive accounts", () => {
    const actor = activeActor();
    expect(
      evaluateAuthorization({
        actor,
        permission: "identity.future.unregistered" as Permission,
      }),
    ).toMatchObject({ allowed: false, reason: "permission_denied" });
    expect(
      decision(
        activeActor({ accountStatus: "suspended" }),
        "identity.profile.read",
        actor.accountId,
      ),
    ).toMatchObject({ allowed: false, reason: "account_inactive" });
  });

  it("limits support operators to minimal reads and session revocation", () => {
    const actor = activeActor({ globalRoles: ["support_operator"] });
    expect(decision(actor, "identity.account.support.read").allowed).toBe(true);
    expect(decision(actor, "identity.account.sessions.revoke").allowed).toBe(true);
    expect(decision(actor, "identity.account.suspend").allowed).toBe(false);
    expect(decision(actor, "identity.global_role.grant").allowed).toBe(false);
  });

  it("does not make platform admin inherit support session-revocation permission", () => {
    const actor = activeActor({ globalRoles: ["platform_admin"] });
    expect(decision(actor, "identity.account.support.read")).toMatchObject({
      allowed: false,
      reason: "permission_denied",
    });
    expect(decision(actor, "identity.account.sessions.revoke")).toMatchObject({
      allowed: false,
      reason: "permission_denied",
    });
    expect(
      decision(
        { ...actor, globalRoles: ["platform_admin", "support_operator"] },
        "identity.account.sessions.revoke",
      ).allowed,
    ).toBe(true);
  });

  it("gives reviewer and finance roles no privileged identity mutation", () => {
    for (const role of ["reviewer", "finance_operator"] as const) {
      const actor = activeActor({ globalRoles: [role] });
      expect(decision(actor, "identity.account.suspend").allowed).toBe(false);
      expect(decision(actor, "identity.global_role.grant").allowed).toBe(false);
    }
  });

  it("requires a fresh MFA-authenticated session for every privileged permission", () => {
    const roleActor = activeActor({ globalRoles: ["platform_admin"] });
    expect(decision(roleActor, "identity.account.suspend").allowed).toBe(true);
    expect(
      decision(
        { ...roleActor, sessionFresh: false },
        "identity.account.suspend",
      ),
    ).toMatchObject({ allowed: false, reason: "fresh_session_required" });
    expect(
      decision(
        { ...roleActor, mfaState: "required" },
        "identity.account.suspend",
      ),
    ).toMatchObject({ allowed: false, reason: "mfa_required" });
  });

  it("forbids platform admins from mutating their own role or status", () => {
    const actor = activeActor({ globalRoles: ["platform_admin"] });
    for (const permission of [
      "identity.account.suspend",
      "identity.account.reactivate",
      "identity.global_role.grant",
      "identity.global_role.revoke",
    ] as const) {
      expect(decision(actor, permission, actor.accountId)).toMatchObject({
        allowed: false,
        reason: "self_mutation_forbidden",
      });
    }
  });
});
