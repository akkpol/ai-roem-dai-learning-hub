import { getAccountHttpHandlers } from "@/modules/identity";

export function GET(request: Request) {
  return getAccountHttpHandlers().listPolicies(request);
}
