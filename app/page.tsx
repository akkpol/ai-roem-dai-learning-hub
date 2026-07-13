import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseDiscovery } from "@/components/course-discovery";
import { getPublishedCourseCatalog } from "@/lib/data/read-model";

export const metadata: Metadata = {
  title: "สำรวจคอร์ส | AI เริ่มได้",
  description: "ค้นหาเส้นทางเรียน AI ตั้งแต่เริ่มต้นจนถึงการใช้งานเฉพาะทาง",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const courses = await getPublishedCourseCatalog();
  if (courses === null) notFound();
  return <CourseDiscovery courses={courses} />;
}
