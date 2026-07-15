import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  assertSafeIntegrationReset,
  preflightSession002DatabaseTarget,
} from "../../scripts/database/provider-preflight";

const projectId = "raspy-feather-85795196";
const branchId = "br-session-002";
const branchName = "session-002-fix-03";
const endpointId = "ep-session-002";
const endpointHost =
  "ep-session-002.ap-southeast-1.aws.neon.tech";
const database = "learning_hub_session_002_test";
const migrationUrl =
  `postgresql://migrator:secret@${endpointHost}/${database}` +
  "?sslmode=verify-full";

function remoteEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  const identity = {
    NEON_PROJECT_ID: projectId,
    NEON_BRANCH_ID: branchId,
    NEON_BRANCH_NAME: branchName,
    NEON_BRANCH_IS_DEFAULT: "false",
    NEON_ENDPOINT_ID: endpointId,
    NEON_ENDPOINT_HOSTNAME: endpointHost,
    NEON_DATABASE_NAME: database,
    ...overrides,
  };
  const requestedPoolerHost = identity.NEON_ENDPOINT_HOSTNAME?.replace(
    identity.NEON_ENDPOINT_ID ?? "",
    `${identity.NEON_ENDPOINT_ID}-pooler`,
  );
  return {
    NEON_API_KEY: "provider-api-secret",
    ...identity,
    DATABASE_URL:
      `postgresql://app:secret@${requestedPoolerHost}/${identity.NEON_DATABASE_NAME}` +
      "?sslmode=require",
    MIGRATION_DATABASE_URL:
      `postgresql://migrator:secret@${identity.NEON_ENDPOINT_HOSTNAME}/` +
      `${identity.NEON_DATABASE_NAME}?sslmode=verify-full`,
    REMOTE_TEST_DATABASE_RESET_ACK: identity.NEON_DATABASE_NAME,
    REMOTE_TEST_NEON_IDENTITY_ACK: [
      identity.NEON_PROJECT_ID,
      identity.NEON_BRANCH_ID,
      identity.NEON_BRANCH_NAME,
      identity.NEON_ENDPOINT_ID,
      identity.NEON_ENDPOINT_HOSTNAME,
      identity.NEON_DATABASE_NAME,
    ].join("|"),
    SESSION_002_APPROVED_NEON_BRANCH_ID: identity.NEON_BRANCH_ID,
    SESSION_002_APPROVED_NEON_BRANCH_NAME: identity.NEON_BRANCH_NAME,
    SESSION_002_APPROVED_NEON_ENDPOINT_ID: identity.NEON_ENDPOINT_ID,
    SESSION_002_APPROVED_NEON_ENDPOINT_HOSTNAME:
      identity.NEON_ENDPOINT_HOSTNAME,
    SESSION_002_APPROVED_NEON_DATABASE_NAME: identity.NEON_DATABASE_NAME,
  };
}

type ProviderFixture = Readonly<{
  branch?: Record<string, unknown>;
  endpoints?: Record<string, unknown>[];
  databases?: Record<string, unknown>[];
  status?: number;
  malformedPath?: "branch" | "endpoints" | "databases";
}>;

function providerFetch(fixture: ProviderFixture = {}) {
  return vi.fn<typeof fetch>(async (request, init) => {
    const url = new URL(request.toString());
    const pathKind = url.pathname.endsWith("/endpoints")
      ? "endpoints"
      : url.pathname.endsWith("/databases")
        ? "databases"
        : "branch";

    expect(url.origin).toBe("https://console.neon.tech");
    expect(url.pathname).toContain(`/api/v2/projects/${projectId}/branches/`);
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer provider-api-secret",
    );

    if (fixture.status) {
      return new Response("provider-body-secret", {
        status: fixture.status,
      });
    }
    if (fixture.malformedPath === pathKind) {
      return new Response('{"provider_secret":"do-not-leak"', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const body = pathKind === "branch"
      ? {
          branch: fixture.branch ?? {
            id: branchId,
            project_id: projectId,
            name: branchName,
            current_state: "ready",
            state_changed_at: "2026-07-16T00:00:00Z",
            creation_source: "console",
            created_at: "2026-07-16T00:00:00Z",
            updated_at: "2026-07-16T00:00:00Z",
            default: false,
            protected: false,
            cpu_used_sec: 0,
            active_time_seconds: 0,
            compute_time_seconds: 0,
            written_data_bytes: 0,
            data_transfer_bytes: 0,
          },
        }
      : pathKind === "endpoints"
        ? {
            endpoints: fixture.endpoints ?? [{
              host: endpointHost,
              id: endpointId,
              project_id: projectId,
              branch_id: branchId,
              region_id: "aws-ap-southeast-1",
              autoscaling_limit_max_cu: 1,
              autoscaling_limit_min_cu: 0.25,
              type: "read_write",
              current_state: "active",
              pooler_enabled: true,
              pooler_mode: "transaction",
              disabled: false,
              passwordless_access: false,
              creation_source: "console",
              created_at: "2026-07-16T00:00:00Z",
              updated_at: "2026-07-16T00:00:00Z",
              settings: { pg_settings: {} },
              proxy_host: "ap-southeast-1.aws.neon.tech",
              suspend_timeout_seconds: 300,
              provisioner: "k8s-neonvm",
            }],
          }
        : {
            databases: fixture.databases ?? [{
              id: 1,
              branch_id: branchId,
              name: database,
              owner_name: "database_owner",
              created_at: "2026-07-16T00:00:00Z",
              updated_at: "2026-07-16T00:00:00Z",
            }],
          };

    return Response.json(body);
  });
}

async function expectProviderRejected(
  input: Record<string, string | undefined>,
  provider: typeof fetch,
): Promise<void> {
  await expect(
    Promise.resolve().then(() =>
      preflightSession002DatabaseTarget(input, provider),
    ),
  ).rejects.toThrow("Database provider preflight rejected");
}

describe("SESSION-002 Neon provider authority", () => {
  it("derives and freezes the exact disposable target from read-only provider truth", async () => {
    const fetchFromProvider = providerFetch();

    const target = await preflightSession002DatabaseTarget(
      remoteEnvironment(),
      fetchFromProvider,
    );

    expect(fetchFromProvider).toHaveBeenCalledTimes(3);
    expect(target.kind).toBe("session-002-neon");
    expect(target.providerIdentity).toEqual({
      projectId,
      branchId,
      branchName,
      endpointId,
      endpointHostname: endpointHost,
      database,
    });
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.isFrozen(target.providerIdentity)).toBe(true);
  });

  it("does not require or call Neon for two loopback targets", async () => {
    const fetchFromProvider = providerFetch();
    const target = await preflightSession002DatabaseTarget({
      DATABASE_URL: "postgresql://app:secret@localhost/local_test",
      MIGRATION_DATABASE_URL:
        "postgresql://migrator:secret@localhost/local_test",
    }, fetchFromProvider);

    expect(target.kind).toBe("local");
    expect(fetchFromProvider).not.toHaveBeenCalled();
  });

  it("requires NEON_API_KEY before a remote provider lookup", async () => {
    await expectProviderRejected(
      remoteEnvironment({ NEON_API_KEY: undefined }),
      providerFetch(),
    );
  });

  it.each([401, 404, 500])(
    "fails closed on Neon HTTP %s without exposing the response body",
    async (status) => {
      const error = await Promise.resolve()
        .then(() => preflightSession002DatabaseTarget(
          remoteEnvironment(),
          providerFetch({ status }),
        ))
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "Database provider preflight rejected",
      );
      expect((error as Error).message).not.toContain("provider-body-secret");
    },
  );

  it.each(["branch", "endpoints", "databases"] as const)(
    "fails closed on malformed %s JSON without exposing provider data",
    async (malformedPath) => {
      const error = await Promise.resolve()
        .then(() => preflightSession002DatabaseTarget(
          remoteEnvironment(),
          providerFetch({ malformedPath }),
        ))
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "Database provider preflight rejected",
      );
      expect((error as Error).message).not.toContain("do-not-leak");
    },
  );

  it("rejects request, approval mirrors, and acknowledgement changed together", async () => {
    const changed = {
      NEON_BRANCH_ID: "br-consistently-changed",
      NEON_BRANCH_NAME: "session-002-changed",
      NEON_ENDPOINT_ID: "ep-consistently-changed",
      NEON_ENDPOINT_HOSTNAME:
        "ep-consistently-changed.ap-southeast-1.aws.neon.tech",
      NEON_DATABASE_NAME: "learning_hub_consistently_changed_test",
    };

    await expectProviderRejected(remoteEnvironment(changed), providerFetch());
  });

  it("rejects a provider branch with the wrong project or requested identity", async () => {
    await expectProviderRejected(
      remoteEnvironment(),
      providerFetch({
        branch: {
          id: "br-other",
          project_id: "wrong-project",
          name: "other",
          default: false,
        },
      }),
    );
  });

  it.each([
    { id: branchId, project_id: projectId, name: branchName, default: true },
    { id: "br-solitary-cell-aorxyd0b", project_id: projectId, name: branchName, default: false },
    { id: branchId, project_id: projectId, name: "preview-production-copy", default: false },
  ])("rejects a provider default or production-like branch", async (branch) => {
    await expectProviderRejected(
      remoteEnvironment({
        NEON_BRANCH_ID: String(branch.id),
        NEON_BRANCH_NAME: String(branch.name),
      }),
      providerFetch({ branch }),
    );
  });

  it("rejects an endpoint not bound by the provider to the requested branch", async () => {
    await expectProviderRejected(
      remoteEnvironment(),
      providerFetch({
        endpoints: [{
          id: endpointId,
          project_id: projectId,
          branch_id: "br-other",
          host: endpointHost,
        }],
      }),
    );
  });

  it("requires migration direct host and application pooler host from provider endpoint", async () => {
    await expectProviderRejected(
      {
        ...remoteEnvironment(),
        DATABASE_URL:
          `postgresql://app:secret@${endpointHost}/${database}?sslmode=require`,
      },
      providerFetch(),
    );
  });

  it("rejects a database not proven on the requested branch", async () => {
    await expectProviderRejected(
      remoteEnvironment(),
      providerFetch({
        databases: [{
          id: 1,
          branch_id: "br-other",
          name: database,
          owner_name: "database_owner",
        }],
      }),
    );
  });

  it("rejects query target overrides before contacting Neon", async () => {
    const fetchFromProvider = providerFetch();
    await expect(Promise.resolve().then(() =>
      preflightSession002DatabaseTarget({
          ...remoteEnvironment(),
          MIGRATION_DATABASE_URL: `${migrationUrl}&host=remote.example.com`,
        }, fetchFromProvider),
    )).rejects.toThrow();
    expect(fetchFromProvider).not.toHaveBeenCalled();
  });

  it("reuses provider-derived evidence for destructive reset", async () => {
    const input = remoteEnvironment();
    const target = await assertSafeIntegrationReset(
      input.MIGRATION_DATABASE_URL ?? "",
      input,
      providerFetch(),
    );

    expect(target.providerIdentity?.branchId).toBe(branchId);
  });
});

describe("provider authority connection ordering", () => {
  it("awaits provider authority before migration and reset connections", () => {
    const migrate = readFileSync(
      new URL("../../scripts/database/migrate.ts", import.meta.url),
      "utf8",
    );
    const setup = readFileSync(
      new URL("../integration/database/global-setup.ts", import.meta.url),
      "utf8",
    );

    expect(migrate).toContain("await readMigrationDatabaseUrl(process.env)");
    expect(migrate.indexOf("await readMigrationDatabaseUrl(process.env)"))
      .toBeLessThan(migrate.indexOf("runMigrations("));
    expect(setup).toContain("await assertSafeIntegrationReset(");
    expect(setup.indexOf("await assertSafeIntegrationReset("))
      .toBeLessThan(setup.indexOf("new Client("));
  });
});
