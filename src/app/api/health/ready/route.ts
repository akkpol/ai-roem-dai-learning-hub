import { getRuntimeDatabaseConnection } from "@/platform/database/client";
import { probeDatabase } from "@/platform/database/readiness";
import { probeIdentityOperationsConfiguration } from "@/modules/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createReadyHandler(
  databaseProbe: () => Promise<void>,
  identityOperationsProbe: () => Promise<void> = async () => undefined,
) {
  return async function GET() {
    try {
      await databaseProbe();
    } catch {
      return Response.json(
        {
          status: "unavailable",
          service: "learning-hub",
          dependencies: {
            database: "unavailable",
            identityOperations: "unknown",
          },
        },
        { status: 503 },
      );
    }
    try {
      await identityOperationsProbe();
      return Response.json({
        status: "ready",
        service: "learning-hub",
        dependencies: {
          database: "ready",
          identityOperations: "ready",
        },
      });
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
        { status: 503 },
      );
    }
  };
}

export const GET = createReadyHandler(
  async () => probeDatabase(getRuntimeDatabaseConnection().db),
  async () => probeIdentityOperationsConfiguration(process.env),
);
