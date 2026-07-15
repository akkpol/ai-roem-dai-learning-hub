import type { Metadata } from "next";
import { TeachingCompass } from "@/components/teach/teaching-compass";
import { getCurrentMember } from "@/lib/auth/session";
import { getInstructorDashboard } from "@/lib/data/instructor-read-model";

export const metadata: Metadata = { title: "พื้นที่ผู้สอน" };

export default async function TeachPage() {
  const member = await getCurrentMember();
  if (!member) return null;
  const dashboard = await getInstructorDashboard(member.userId, member.displayName, member.demo);

  return <TeachingCompass dashboard={dashboard} />;
}
