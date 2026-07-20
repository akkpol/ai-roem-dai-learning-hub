import { beforeEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => ({
  getSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  verifyBackupCode: vi.fn(),
}));

vi.mock("@/modules/identity/auth", () => ({
  createTransactionAuth: () => ({ api: authApi }),
}));

import { createAccountHttpHandlers } from "@/modules/identity/account-http";
import {
  createAccountSecurityService,
  verifySecondFactor,
} from "@/modules/identity/account-security";

const config = {
  baseUrl: "https://learning.example.test/api/auth",
  authSecret: "s".repeat(32),
} as never;

function databaseWithSelections(...rows: unknown[][]) {
  let selection = 0;
  const transaction = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => rows[selection++] ?? []),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn() })),
  };
  return {
    transaction: vi.fn(async (work: (tx: typeof transaction) => unknown) => work(transaction)),
  } as never;
}

describe("SESSION-004 HTTP and session security negatives", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects foreign Host and Origin before consuming a deletion token", async () => {
    const confirmDeletion = vi.fn();
    const handlers = createAccountHttpHandlers({
      account: {} as never,
      privacy: { confirmDeletion } as never,
      config,
    });
    const foreignHost = await handlers.confirmDeletion(
      new Request("https://evil.example/api/account/privacy/deletion/confirm?token=secret", {
        method: "POST",
        headers: { host: "evil.example", origin: "https://evil.example" },
      }),
    );
    expect(foreignHost.status).toBe(403);
    expect(confirmDeletion).not.toHaveBeenCalled();

    const foreignOrigin = await handlers.confirmDeletion(
      new Request("https://learning.example.test/api/account/privacy/deletion/confirm?token=secret", {
        method: "POST",
        headers: { host: "learning.example.test", origin: "https://evil.example" },
      }),
    );
    expect(foreignOrigin.status).toBe(403);
    expect(confirmDeletion).not.toHaveBeenCalled();
  });

  it("renders deletion confirmation without consuming the token", async () => {
    const confirmDeletion = vi.fn();
    const handlers = createAccountHttpHandlers({
      account: {} as never,
      privacy: { confirmDeletion } as never,
      config,
    });
    const response = handlers.renderDeletionConfirmation(
      new Request("https://learning.example.test/api/account/privacy/deletion/confirm?token=secret", {
        headers: { host: "learning.example.test" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('method="post"');
    expect(confirmDeletion).not.toHaveBeenCalled();
  });

  it("returns safe structured 400 field errors without invoking profile mutation", async () => {
    const updateOwnProfile = vi.fn();
    const handlers = createAccountHttpHandlers({
      account: { updateOwnProfile } as never,
      privacy: {} as never,
      config,
    });
    const response = await handlers.updateProfile(
      new Request("https://learning.example.test/api/account/profile", {
        method: "PATCH",
        headers: {
          host: "learning.example.test",
          origin: "https://learning.example.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ displayName: "", locale: "xx", timeZone: "Mars/Olympus" }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: false,
      fieldErrors: {
        displayName: expect.any(String),
        locale: expect.any(String),
        timeZone: expect.any(String),
      },
    });
    expect(updateOwnProfile).not.toHaveBeenCalled();
  });

  it("fails closed for revoked and inactive sessions", async () => {
    authApi.getSession.mockResolvedValueOnce(null);
    const revoked = createAccountSecurityService(databaseWithSelections(), config);
    await expect(revoked.listDeviceSessions(new Headers())).rejects.toThrow(
      "authentication required",
    );

    authApi.getSession.mockResolvedValueOnce({
      user: { id: "account-a" },
      session: { id: "session-a", createdAt: new Date() },
    });
    const suspended = createAccountSecurityService(
      databaseWithSelections([{ status: "suspended", twoFactorEnabled: false }]),
      config,
    );
    await expect(suspended.listPolicyHistory(new Headers())).rejects.toThrow(
      "active account required",
    );
  });

  it("does not revoke another account session and rejects stale secure actions", async () => {
    authApi.getSession.mockResolvedValueOnce({
      user: { id: "account-a" },
      session: { id: "session-a", createdAt: new Date() },
    });
    const service = createAccountSecurityService(
      databaseWithSelections(
        [{ status: "active", twoFactorEnabled: false }],
        [],
      ),
      config,
    );
    await expect(
      service.revokeDeviceSession(new Headers(), "00000000-0000-4000-8000-000000000002"),
    ).resolves.toEqual({ status: true });
    expect(authApi.revokeSession).not.toHaveBeenCalled();

    authApi.getSession.mockResolvedValueOnce({
      user: { id: "account-a" },
      session: { id: "session-a", createdAt: new Date(Date.now() - 11 * 60_000) },
    });
    const stale = createAccountSecurityService(
      databaseWithSelections([{ status: "active", twoFactorEnabled: false }]),
      config,
    );
    await expect(stale.revokeOtherSessions(new Headers())).rejects.toThrow(
      "fresh session required",
    );
    expect(authApi.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it("forwards recovery verification with consuming and trusted-device-safe flags", async () => {
    authApi.verifyBackupCode.mockResolvedValueOnce({ status: true });
    const auth = { api: authApi } as never;
    const headers = new Headers();
    await expect(
      verifySecondFactor(auth, headers, { kind: "recovery", code: "one-time" }),
    ).resolves.toBeUndefined();
    expect(authApi.verifyBackupCode).toHaveBeenCalledWith({
      body: { code: "one-time", disableSession: true, trustDevice: false },
      headers,
    });
  });
});
