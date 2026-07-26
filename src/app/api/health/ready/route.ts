import { getRuntimeDatabaseConnection } from "@/platform/database/client";
import { probeDatabase } from "@/platform/database/readiness";
import {
  emitStructuredTelemetry,
  requestCorrelationId,
  type Telemetry,
} from "@/platform/observability/telemetry";
import { probeIdentityOperationsConfiguration } from "@/modules/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createReadyHandler(
  databaseProbe: () => Promise<void>,
  identityOperationsProbe: () => Promise<void> = async () => undefined,
  telemetry: Telemetry = emitStructuredTelemetry,
  now: () => number = Date.now,
) {
  return async function GET(request?: Request) {
    const correlationId = requestCorrelationId(request);
    const startedAt = now();
    try {
      await databaseProbe();
    } catch {
      const durationMs = Math.max(0, now() - startedAt);
      telemetry("platform.database.readiness", {
        correlationId,
        durationMs,
        ready: false,
      });
      return Response.json(
        {
          status: "unavailable",
          service: "learning-hub",
          dependencies: {
            database: "unavailable",
            identityOperations: "unknown",
          },
        },
        {
          status: 503,
          headers: { "x-correlation-id": correlationId },
        },
      );
    }
    const durationMs = Math.max(0, now() - startedAt);
    telemetry("platform.database.readiness", {
      correlationId,
      durationMs,
      ready: true,
    });
    if (durationMs > 1_000) {
      telemetry("platform.database.readiness.alert", {
        correlationId,
        durationMs,
        thresholdMs: 1_000,
      });
    }
    try {
      await identityOperationsProbe();
      return Response.json(
        {
          status: "ready",
          service: "learning-hub",
          dependencies: {
            database: "ready",
            identityOperations: "ready",
          },
        },
        { headers: { "x-correlation-id": correlationId } },
      );
    } catch {
      return Response.json(
        {
          status: "unavailable",
          service: "learning-hub",
          dependencies: {
            database: "ready",
            identityOperations: "unavailable",
          },
        },
        {
          status: 503,
          headers: { "x-correlation-id": correlationId },
        },
      );
    }
  };
}

export const GET = createReadyHandler(
  async () => probeDatabase(getRuntimeDatabaseConnection().db),
  async () => probeIdentityOperationsConfiguration(process.env),
);
