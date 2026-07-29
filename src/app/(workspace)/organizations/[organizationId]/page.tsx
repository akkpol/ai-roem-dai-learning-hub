import { OrganizationWorkspace } from "../_components/organization-workspace";

export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  return <OrganizationWorkspace organizationId={(await params).organizationId} />;
}
