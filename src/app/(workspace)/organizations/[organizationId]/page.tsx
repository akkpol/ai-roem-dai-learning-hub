import { headers } from "next/headers";

import { loadOrganizationWorkspaceForServer } from "@/modules/organizations";

import { OrganizationWorkspaceContent } from "../_components/organization-content";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const organizationId = (await params).organizationId;
  const request = new Request(`http://localhost/organizations/${organizationId}`, { headers: new Headers(await headers()) });
  return <OrganizationWorkspaceContent state={await loadOrganizationWorkspaceForServer(request, organizationId)} />;
}
