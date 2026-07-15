import { notFound } from "next/navigation";
import { CourseStudio } from "@/components/teach/course-studio";
import { getCurrentMember } from "@/lib/auth/session";
import { getCourseStudioView } from "@/lib/data/course-studio-read-model";

export default async function CourseStudioPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) return null;
  const { courseId } = await params;
  const studio = await getCourseStudioView(courseId, member.userId, member.demo);
  if (!studio) notFound();

  return <CourseStudio studio={studio} demo={member.demo} />;
}
