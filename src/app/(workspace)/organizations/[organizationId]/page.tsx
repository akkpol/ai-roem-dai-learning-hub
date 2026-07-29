import { headers } from "next/headers";

import { loadOrganizationWorkspaceForServer } from "@/modules/organizations";

import { OrganizationWorkspace } from "../_components/organization-workspace";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const organizationId = (await params).organizationId;
  const request = new Request(`http://localhost/organizations/${organizationId}`, { headers: new Headers(await headers()) });
  return <OrganizationWorkspace organizationId={organizationId} initialState={await loadOrganizationWorkspaceForServer(request, organizationId)} />;
}
