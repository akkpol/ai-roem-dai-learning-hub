import { getIdentityAdminHttpHandlers } from "@/modules/identity";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { accountId } = await context.params;
  return getIdentityAdminHttpHandlers().getAccount(request, accountId);
}

export async function POST(request: Request, context: RouteContext) {
  const { accountId } = await context.params;
  return getIdentityAdminHttpHandlers().mutateAccount(request, accountId);
}
