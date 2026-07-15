import { NextRequest } from "next/server";
import { isValidCronAuthorization } from "@/lib/security/cron";
import { processCohortDeadlines, queueCohortDeadlineReminders } from "@/lib/services/cohorts";
import { expirePaymentWindows } from "@/lib/services/commerce";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isValidCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [deadlines, reminders, expiredOrders] = await Promise.all([
    processCohortDeadlines(),
    queueCohortDeadlineReminders(),
    expirePaymentWindows(),
  ]);
  return Response.json({ deadlines, reminders, expiredOrders });
}
