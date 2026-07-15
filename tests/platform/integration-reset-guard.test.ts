import { describe, expect, it } from "vitest";
import { parse as parsePostgresConnectionString } from "pg-connection-string";

import { assertSafeIntegrationReset } from "../integration/database/global-setup";

const approvedIdentity = {
  NEON_PROJECT_ID: "raspy-feather-85795196",
  NEON_BRANCH_ID: "br-session-002",
  NEON_BRANCH_NAME: "session-002-580e95d2",
  NEON_BRANCH_IS_DEFAULT: "false",
  NEON_ENDPOINT_ID: "ep-session-002",
  NEON_ENDPOINT_HOSTNAME: "ep-session-002.ap-southeast-1.aws.neon.tech",
  NEON_DATABASE_NAME: "learning_hub_session_002_test",
};

const approvedAcceptance = {
  SESSION_002_APPROVED_NEON_BRANCH_ID: approvedIdentity.NEON_BRANCH_ID,
  SESSION_002_APPROVED_NEON_BRANCH_NAME: approvedIdentity.NEON_BRANCH_NAME,
  SESSION_002_APPROVED_NEON_ENDPOINT_ID: approvedIdentity.NEON_ENDPOINT_ID,
  SESSION_002_APPROVED_NEON_ENDPOINT_HOSTNAME:
    approvedIdentity.NEON_ENDPOINT_HOSTNAME,
  SESSION_002_APPROVED_NEON_DATABASE_NAME: approvedIdentity.NEON_DATABASE_NAME,
};

const approvedUrl =
  "postgresql://migrator:secret@ep-session-002.ap-southeast-1.aws.neon.tech/" +
  "learning_hub_session_002_test?sslmode=verify-full";
const approvedApplicationUrl =
  "postgresql://app:secret@ep-session-002-pooler.ap-southeast-1.aws.neon.tech/" +
  "learning_hub_session_002_test?sslmode=require";

function resetEnvironment(
  overrides: Partial<Record<keyof typeof approvedIdentity, string | undefined>> = {},
  acknowledgeOverrides = false,
): Record<string, string | undefined> {
  const identity = { ...approvedIdentity, ...overrides };
  const acknowledgedIdentity = acknowledgeOverrides ? identity : approvedIdentity;
  return {
    ...approvedAcceptance,
    ...identity,
    DATABASE_URL: approvedApplicationUrl,
    MIGRATION_DATABASE_URL: approvedUrl,
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

  it("rejects a pg-connection-string host override before destructive reset", () => {
    const overriddenUrl = `${approvedUrl}&host=remote.example.com`;
    expect(parsePostgresConnectionString(overriddenUrl).host).toBe(
      "remote.example.com",
    );
    expectResetRejected(
      overriddenUrl,
      { ...resetEnvironment(), MIGRATION_DATABASE_URL: overriddenUrl },
    );
  });

  it("rejects hostaddr before destructive reset", () => {
    const overriddenUrl = `${approvedUrl}&hostaddr=192.0.2.1`;
    expectResetRejected(
      overriddenUrl,
      { ...resetEnvironment(), MIGRATION_DATABASE_URL: overriddenUrl },
    );
  });

  it("rejects an internally consistent wrong project", () => {
    expectResetRejected(
      approvedUrl,
      resetEnvironment({ NEON_PROJECT_ID: "wrong-project" }, true),
    );
  });

  it("rejects an internally consistent branch outside trusted acceptance metadata", () => {
    expectResetRejected(
      approvedUrl,
      resetEnvironment({
        NEON_BRANCH_ID: "br-unapproved",
        NEON_BRANCH_NAME: "unapproved-preview",
      }, true),
    );
  });

  it("rejects the trusted default branch ID even when declared non-default", () => {
    expectResetRejected(
      approvedUrl,
      {
        ...resetEnvironment({
          NEON_BRANCH_ID: "br-solitary-cell-aorxyd0b",
          NEON_BRANCH_NAME: "preview-looking-name",
        }, true),
        SESSION_002_APPROVED_NEON_BRANCH_ID: "br-solitary-cell-aorxyd0b",
        SESSION_002_APPROVED_NEON_BRANCH_NAME: "preview-looking-name",
      },
    );
  });

  it("rejects a consistently changed endpoint outside trusted acceptance metadata", () => {
    const wrongHostname = "ep-unapproved.ap-southeast-1.aws.neon.tech";
    expectResetRejected(
      approvedUrl.replace(approvedIdentity.NEON_ENDPOINT_HOSTNAME, wrongHostname),
      resetEnvironment({
        NEON_ENDPOINT_ID: "ep-unapproved",
        NEON_ENDPOINT_HOSTNAME: wrongHostname,
      }, true),
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
