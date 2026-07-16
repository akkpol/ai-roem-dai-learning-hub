import { getRuntimeDatabaseConnection } from "@/platform/database/client";
import { probeDatabase } from "@/platform/database/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createReadyHandler(probe: () => Promise<void>) {
  return async function GET() {
    try {
      await probe();

      return Response.json({
        status: "ready",
        service: "learning-hub",
        dependencies: { database: "ready" },
      });
    } catch {
      return Response.json(
        {
          status: "unavailable",
          service: "learning-hub",
          dependencies: { database: "unavailable" },
        },
        { status: 503 },
      );
    }
  };
}

export const GET = createReadyHandler(async () =>
  probeDatabase(getRuntimeDatabaseConnection().db),
);
