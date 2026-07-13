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
    return Response.json({
      claimed: 0,
      sent: 0,
      failed: 0,
      skipped: "gmail_smtp_not_configured",
    });
  }

  const result = await sendPendingNotifications();
  return Response.json(result);
}
