import { getOrganizationHttpHandlers } from "@/modules/organizations";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  return getOrganizationHttpHandlers().getOrganization(request, (await params).organizationId);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  return getOrganizationHttpHandlers().updateOrganization(request, (await params).organizationId);
}
