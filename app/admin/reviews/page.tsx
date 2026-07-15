import { ReviewQueue } from "@/components/admin/review-queue";
import { getCurrentMember } from "@/lib/auth/session";
import { getCourseReviewQueue } from "@/lib/data/course-studio-read-model";

export default async function AdminReviewsPage() {
  const member = await getCurrentMember();
  const queue = await getCourseReviewQueue(Boolean(member?.demo));
  return <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">COURSE REVIEW</p><h1>Revision ที่รอตัดสินใจ</h1><p>ตรวจเนื้อหา ราคา และเงื่อนไขก่อนเปิดขาย โดยไม่แก้ snapshot ของผู้เรียนโดยตรง</p></div></div><ReviewQueue queue={queue} demo={Boolean(member?.demo)} /></main>;
}
