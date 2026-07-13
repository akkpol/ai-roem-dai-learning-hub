import { NextRequest } from "next/server";
import { sendPendingNotifications } from "@/lib/email/outbox";
import { hasGmailConfiguration } from "@/lib/email/gmail";
import { isValidCronAuthorization } from "@/lib/security/cron";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isValidCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasGmailConfiguration()) {
    const unavailable = {
      error: "Email provider unavailable",
      code: "gmail_smtp_not_configured",
      claimed: 0,
      sent: 0,
      failed: 0,
    };
    console.error("notification_delivery_unavailable", unavailable);
    return Response.json(unavailable, { status: 503 });
  }

  const result = await sendPendingNotifications();
  if (result.failed > 0) {
    const failed = { error: "Notification delivery failed", ...result };
    console.error("notification_delivery_failed", failed);
    return Response.json(failed, { status: 502 });
  }

  return Response.json(result);
}
