import { getIdentityHttpHandlers } from "@/modules/identity";

export function GET(request: Request): Promise<Response> {
  return getIdentityHttpHandlers().verifyEmail(request);
}
