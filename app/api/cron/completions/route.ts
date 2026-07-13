import { NextRequest } from "next/server";
import { isValidCronAuthorization } from "@/lib/security/cron";
import { processEnrollmentCompletions } from "@/lib/services/completions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isValidCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await processEnrollmentCompletions());
}
