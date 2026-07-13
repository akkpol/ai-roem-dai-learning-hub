import type { Metadata } from "next";
import { CourseDiscovery } from "@/components/course-discovery";

export const metadata: Metadata = {
  title: "สำรวจคอร์ส | AI เริ่มได้",
  description: "ค้นหาเส้นทางเรียน AI ตั้งแต่เริ่มต้นจนถึงการใช้งานเฉพาะทาง",
};

export default function HomePage() {
  return <CourseDiscovery />;
}
