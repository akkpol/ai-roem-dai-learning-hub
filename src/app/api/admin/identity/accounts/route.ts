import { getIdentityAdminHttpHandlers } from "@/modules/identity";

export function GET(request: Request) {
  return getIdentityAdminHttpHandlers().searchAccounts(request);
}
