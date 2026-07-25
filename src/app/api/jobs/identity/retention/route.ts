import { getIdentityJobHandlers } from "@/modules/identity";

export function GET(request: Request) {
  return getIdentityJobHandlers().retention(request);
}
