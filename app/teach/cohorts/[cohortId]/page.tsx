import { notFound } from "next/navigation";
import { CohortWorkspace } from "@/components/teach/cohort-workspace";
import { getCurrentMember } from "@/lib/auth/session";
import { getInstructorCohortWorkspace } from "@/lib/data/instructor-cohort-read-model";

export default async function InstructorCohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const member = await getCurrentMember();
  if (!member) return null;
  const { cohortId } = await params;
  const workspace = await getInstructorCohortWorkspace(cohortId, member.userId, member.demo);
  if (!workspace) notFound();
  return <CohortWorkspace workspace={workspace} demo={member.demo} />;
}
