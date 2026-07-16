import { getIdentityHttpHandlers } from "@/modules/identity";

export function POST(request: Request): Promise<Response> {
  return getIdentityHttpHandlers().signIn(request);
}
