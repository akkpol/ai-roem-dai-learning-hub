import { describe, expect, it } from "vitest";

import { assertSafeIntegrationReset } from "../integration/database/global-setup";

const approvedIdentity = {
  NEON_PROJECT_ID: "project-session-002",
  NEON_BRANCH_ID: "br-session-002",
  NEON_BRANCH_NAME: "session-002-580e95d2",
  NEON_BRANCH_IS_DEFAULT: "false",
  NEON_ENDPOINT_ID: "ep-session-002",
  NEON_ENDPOINT_HOSTNAME: "ep-session-002.ap-southeast-1.aws.neon.tech",
  NEON_DATABASE_NAME: "learning_hub_session_002_test",
};

const approvedUrl =
  "postgresql://migrator:secret@ep-session-002.ap-southeast-1.aws.neon.tech/" +
  "learning_hub_session_002_test?sslmode=require";

function resetEnvironment(
  overrides: Partial<Record<keyof typeof approvedIdentity, string | undefined>> = {},
  acknowledgeOverrides = false,
): Record<string, string | undefined> {
  const identity = { ...approvedIdentity, ...overrides };
  const acknowledgedIdentity = acknowledgeOverrides ? identity : approvedIdentity;
  return {
    ...identity,
    REMOTE_TEST_DATABASE_RESET_ACK: approvedIdentity.NEON_DATABASE_NAME,
    REMOTE_TEST_NEON_IDENTITY_ACK: [
      acknowledgedIdentity.NEON_PROJECT_ID,
      acknowledgedIdentity.NEON_BRANCH_ID,
      acknowledgedIdentity.NEON_BRANCH_NAME,
      acknowledgedIdentity.NEON_ENDPOINT_ID,
      acknowledgedIdentity.NEON_ENDPOINT_HOSTNAME,
      acknowledgedIdentity.NEON_DATABASE_NAME,
    ].join("|"),
  };
}

function expectResetRejected(
  url: string,
  input: Record<string, string | undefined>,
): void {
  expect(() => assertSafeIntegrationReset(url, input)).toThrow(
    "Refusing destructive integration reset",
  );
}

describe("assertSafeIntegrationReset", () => {
  it("allows one fully matching disposable non-default Neon identity", () => {
    expect(() =>
      assertSafeIntegrationReset(approvedUrl, resetEnvironment()),
    ).not.toThrow();
  });

  it("rejects the same database name on a different hostname", () => {
    expectResetRejected(
      approvedUrl.replace("ep-session-002.", "ep-other."),
      resetEnvironment(),
    );
  });

  it.each([
    "NEON_PROJECT_ID",
    "NEON_BRANCH_ID",
    "NEON_ENDPOINT_ID",
    "NEON_ENDPOINT_HOSTNAME",
    "NEON_DATABASE_NAME",
  ] as const)("rejects a missing %s", (field) => {
    expectResetRejected(approvedUrl, resetEnvironment({ [field]: undefined }));
  });

  it.each([
    "NEON_PROJECT_ID",
    "NEON_BRANCH_ID",
    "NEON_ENDPOINT_ID",
  ] as const)("rejects a mismatched %s", (field) => {
    const input = resetEnvironment();
    input[field] = `different-${field.toLowerCase()}`;
    expectResetRejected(approvedUrl, input);
  });

  it("rejects a mismatched endpoint hostname", () => {
    expectResetRejected(
      approvedUrl,
      resetEnvironment({
        NEON_ENDPOINT_HOSTNAME: "ep-other.ap-southeast-1.aws.neon.tech",
      }, true),
    );
  });

  it("rejects a mismatched database", () => {
    expectResetRejected(
      approvedUrl,
      resetEnvironment({ NEON_DATABASE_NAME: "different_test" }, true),
    );
  });

  it.each([undefined, "database-only", "mismatched-identity"])(
    "rejects a missing or mismatched identity acknowledgement",
    (acknowledgement) => {
      expectResetRejected(approvedUrl, {
        ...resetEnvironment(),
        REMOTE_TEST_NEON_IDENTITY_ACK: acknowledgement,
      });
    },
  );

  it("rejects a missing database acknowledgement", () => {
    expectResetRejected(approvedUrl, {
      ...resetEnvironment(),
      REMOTE_TEST_DATABASE_RESET_ACK: undefined,
    });
  });

  it.each([
    { NEON_BRANCH_IS_DEFAULT: "true" },
    { NEON_BRANCH_NAME: "production", NEON_BRANCH_IS_DEFAULT: "false" },
    { NEON_BRANCH_NAME: "main", NEON_BRANCH_IS_DEFAULT: "false" },
  ])("rejects a declared default or production branch", (override) => {
    expectResetRejected(approvedUrl, resetEnvironment(override, true));
  });

  it("rejects a non-Neon or loopback endpoint", () => {
    expectResetRejected(
      "postgresql://migrator:secret@127.0.0.1/learning_hub_session_002_test",
      resetEnvironment({ NEON_ENDPOINT_HOSTNAME: "127.0.0.1" }, true),
    );
  });
});
