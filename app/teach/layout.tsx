import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasRole } from "@/lib/auth/roles";
import { getCurrentMember } from "@/lib/auth/session";
import { learningStudioFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function TeachLayout({ children }: { children: React.ReactNode }) {
  if (!learningStudioFlags.workspaces) redirect("/learn");
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in?next=/teach");
  if (!hasRole(member.roles, "instructor")) redirect("/learn");

  return <AppShell active="teach">{children}</AppShell>;
}
