import { NextRequest } from "next/server";
import { sendPendingNotifications } from "@/lib/email/outbox";
import { isValidCronAuthorization } from "@/lib/security/cron";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isValidCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendPendingNotifications();
  return Response.json(result);
}
