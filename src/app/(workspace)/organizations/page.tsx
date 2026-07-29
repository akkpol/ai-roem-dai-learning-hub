import { headers } from "next/headers";

import { loadOrganizationListForServer } from "@/modules/organizations";

import { OrganizationList } from "./_components/organization-workspace";

export default async function OrganizationsPage() {
  const request = new Request("http://localhost/organizations", { headers: new Headers(await headers()) });
  return <OrganizationList initialState={await loadOrganizationListForServer(request)} />;
}
