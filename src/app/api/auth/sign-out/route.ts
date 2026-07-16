import { getIdentityHttpHandlers } from "@/modules/identity";

export function POST(request: Request): Promise<Response> {
  return getIdentityHttpHandlers().signOut(request);
}
