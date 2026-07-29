import { getOrganizationHttpHandlers } from "@/modules/organizations";

export function GET(request: Request) {
  return getOrganizationHttpHandlers().listOrganizations(request);
}

export function POST(request: Request) {
  return getOrganizationHttpHandlers().createOrganization(request);
}
