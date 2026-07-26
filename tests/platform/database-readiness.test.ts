import { describe, expect, it, vi } from "vitest";

import { createReadyHandler } from "@/app/api/health/ready/route";

describe("database readiness", () => {
  it("reports ready when the injected database probe succeeds", async () => {
    const GET = createReadyHandler(async () => {});

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ready",
      service: "learning-hub",
      dependencies: {
        database: "ready",
        identityOperations: "ready",
      },
    });
  });

  it("reports unavailable without leaking injected probe errors", async () => {
    const fakeSecret = "postgresql://app:fake-secret@localhost/learning_hub";
    const GET = createReadyHandler(async () => {
      throw new Error(`database connection failed: ${fakeSecret}`);
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "unavailable",
      service: "learning-hub",
      dependencies: {
        database: "unavailable",
        identityOperations: "unknown",
      },
    });
    expect(JSON.stringify(body)).not.toContain(fakeSecret);
  });

  it("fails closed on missing Identity operations configuration after the database is ready", async () => {
    const GET = createReadyHandler(
      async () => undefined,
      async () => {
        throw new Error("RESEND_WEBHOOK_SECRET=secret-value");
      },
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "unavailable",
      service: "learning-hub",
      dependencies: {
        database: "ready",
        identityOperations: "unavailable",
      },
    });
    expect(JSON.stringify(body)).not.toContain("secret-value");
  });

  it("emits bounded database readiness latency with a correlation ID", async () => {
    const telemetry = vi.fn();
    const clock = [100, 1_135];
    const GET = createReadyHandler(
      async () => undefined,
      async () => undefined,
      telemetry,
      () => clock.shift() ?? 135,
    );

    const response = await GET(
      new Request("https://example.test/api/health/ready", {
        headers: { "x-correlation-id": "ready-test-1" },
      }),
    );

    expect(response.headers.get("x-correlation-id")).toBe("ready-test-1");
    expect(telemetry).toHaveBeenCalledWith("platform.database.readiness", {
      correlationId: "ready-test-1",
      durationMs: 1_035,
      ready: true,
    });
    expect(telemetry).toHaveBeenCalledWith(
      "platform.database.readiness.alert",
      {
        correlationId: "ready-test-1",
        durationMs: 1_035,
        thresholdMs: 1_000,
      },
    );
  });
});
