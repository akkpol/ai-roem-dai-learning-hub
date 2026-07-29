import { headers } from "next/headers";

import { loadOrganizationListForServer } from "@/modules/organizations";

import { OrganizationListContent } from "./_components/organization-content";

export default async function OrganizationsPage() {
  const request = new Request("http://localhost/organizations", { headers: new Headers(await headers()) });
  return <OrganizationListContent state={await loadOrganizationListForServer(request)} />;
}
