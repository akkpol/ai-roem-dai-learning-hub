import { describe, expect, it } from "vitest";

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
});
