import { describe, expect, it, vi } from "vitest";

const {
  coreConfig,
  readCoreAuthConfigMock,
  readIdentityConfigMock,
  handlers,
  createGoogleLoginHandlersMock,
  database,
} = vi.hoisted(() => {
  const coreConfig = {
    authSecret: "a".repeat(32),
    baseUrl: "https://learning.example.test/api/auth",
    trustedProxy: "vercel" as const,
    googleOAuth: {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    },
    currentPolicies: {
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
    },
  };
  return {
    coreConfig,
    readCoreAuthConfigMock: vi.fn(() => coreConfig),
    readIdentityConfigMock: vi.fn(() => {
      throw new Error("full identity config must not be read");
    }),
    handlers: { start: vi.fn(), callback: vi.fn() },
    createGoogleLoginHandlersMock: vi.fn(),
    database: {},
  };
});

vi.mock("@/modules/identity/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/identity/config")>()),
  readCoreAuthConfig: readCoreAuthConfigMock,
  readIdentityConfig: readIdentityConfigMock,
}));
vi.mock("@/platform/database/client", () => ({
  getRuntimeDatabaseConnection: vi.fn(() => ({ db: database })),
}));
vi.mock("@/modules/identity/google-login", () => ({
  createGoogleLoginHandlers: createGoogleLoginHandlersMock,
}));

import { getGoogleLoginHandlers } from "@/modules/identity/runtime";

describe("Google login runtime configuration", () => {
  it("does not require the full email and policy configuration", () => {
    createGoogleLoginHandlersMock.mockReturnValueOnce(handlers);

    expect(getGoogleLoginHandlers()).toBe(handlers);
    expect(readCoreAuthConfigMock).toHaveBeenCalledWith(process.env);
    expect(readIdentityConfigMock).not.toHaveBeenCalled();
    expect(createGoogleLoginHandlersMock).toHaveBeenCalledWith(
      database,
      coreConfig,
    );
  });
});
