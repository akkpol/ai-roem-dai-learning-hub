import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, Clock, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { CohortReservationCard } from "@/components/cohort-reservation-card";
import { getCurrentMember } from "@/lib/auth/session";
import { getCourseDetail } from "@/lib/data/read-model";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const course = await getCourseDetail((await params).slug);
  return { title: course?.title ?? "ไม่พบคอร์ส", description: course?.summary };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [course, member] = await Promise.all([getCourseDetail(slug), getCurrentMember()]);
  if (!course) notFound();
  const image = course.cover === "analytics" ? "/images/course-data-analysis.webp" : "/images/course-ai-fundamentals.webp";

  return (
    <AppShell active="courses">
      <main className="portal-main course-detail-page">
        <Link className="back-link" href="/">← กลับไปดูคอร์สทั้งหมด</Link>
        <div className="course-detail-grid">
          <article className="course-detail-content">
            <Image className="detail-cover" src={image} alt="" width={860} height={360} priority />
            <div className="detail-badges"><span>{course.level}</span><span>{course.format}</span><span>{course.tools.join(" · ")}</span></div>
            <h1>{course.title}</h1>
            <p className="detail-lead">{course.summary}</p>
            <div className="course-fact-strip">
              <span><Clock /> {course.duration}</span>
              <span><GraduationCap /> {course.instructor}</span>
              <span>{course.certificate ? "มีใบประกาศเมื่อผ่านเกณฑ์" : "ไม่มีใบประกาศ"}</span>
            </div>
            <section className="detail-section">
              <p className="eyebrow">สิ่งที่คุณจะทำได้</p>
              <h2>เรียนแล้วนำไปใช้กับงานจริง</h2>
              <ul className="outcome-list">
                {course.outcomes.map((outcome) => <li key={outcome}><CheckCircle weight="fill" /> {outcome}</li>)}
              </ul>
            </section>
            <section className="detail-section process-panel">
              <p className="eyebrow">ขั้นตอนของ Closed Beta</p>
              <ol>
                <li><b>1</b><span>เข้าสู่ระบบด้วยอีเมลที่ได้รับคำเชิญ</span></li>
                <li><b>2</b><span>จองวันเรียน — ยังไม่มีค่าใช้จ่ายและยังไม่ยืนยันเปิดคลาส</span></li>
                <li><b>3</b><span>เมื่อครบขั้นต่ำ ทีมงานตรวจผู้สอน ตาราง และต้นทุนก่อนยืนยัน</span></li>
                <li><b>4</b><span>เมื่อเปิดแน่นอน จึงสร้าง enrollment และแสดงลิงก์เรียน</span></li>
              </ol>
            </section>
          </article>
          <div className="course-detail-aside">
            {course.cohort ? (
              <CohortReservationCard cohort={course.cohort} courseSlug={course.id} demo={Boolean(member?.demo)} />
            ) : (
              <aside className="reservation-card"><span className="status-badge">เรียนย้อนหลัง</span><h2>เรียนได้ตามเวลาของคุณ</h2><p>สมาชิกที่ได้รับสิทธิ์จะเห็นวิดีโอ YouTube Private จากหน้าการเรียน</p><Link className="primary-cta link-cta" href="/auth/sign-in">เข้าสู่ระบบ</Link></aside>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
