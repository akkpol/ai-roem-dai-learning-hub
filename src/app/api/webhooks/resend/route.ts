import { handleResendWebhookRequest } from "@/modules/identity";

export function POST(request: Request) {
  return handleResendWebhookRequest(request);
}
