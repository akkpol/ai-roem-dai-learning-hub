import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarBlank,
  CaretRight,
  ChalkboardTeacher,
  ChatCircleDots,
  CheckSquareOffset,
  Clock,
  TrendUp,
  UserList,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import type { InstructorDashboard } from "@/lib/data/instructor-read-model";

const bangkokDate = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const shortDate = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const time = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

function QueueIcon({ kind }: { kind: InstructorDashboard["queue"][number]["kind"] }) {
  if (kind === "qna") return <ChatCircleDots aria-hidden="true" />;
  if (kind === "attendance") return <UserList aria-hidden="true" />;
  if (kind === "risk") return <TrendUp aria-hidden="true" />;
  return <CheckSquareOffset aria-hidden="true" />;
}

export function TeachingCompass({ dashboard }: { dashboard: InstructorDashboard }) {
  return (
    <main className="teach-main">
      <header className="teach-welcome">
        <h1>สวัสดีตอนเช้า อ. {dashboard.instructorName}</h1>
        <p>{bangkokDate.format(new Date("2026-07-14T02:00:00.000Z"))}</p>
      </header>

      {dashboard.nextSession ? (
        <section className="next-class" aria-labelledby="next-class-title">
          <p className="next-class-kicker">คาบสอนถัดไป</p>
          <div className="next-class-grid">
            <Image
              src={dashboard.nextSession.coverUrl}
              alt=""
              width={288}
              height={166}
              priority
            />
            <div className="next-class-copy">
              <span>คลาสสด</span>
              <h2 id="next-class-title">{dashboard.nextSession.courseTitle}</h2>
              <div className="next-class-meta">
                <p><CalendarBlank aria-hidden="true" /> {shortDate.format(dashboard.nextSession.startsAt)}</p>
                <p><Clock aria-hidden="true" /> {time.format(dashboard.nextSession.startsAt)}–{time.format(dashboard.nextSession.endsAt)} น.</p>
                <p><UsersThree aria-hidden="true" /> ผู้เรียน {dashboard.nextSession.learnerCount} คน</p>
              </div>
            </div>
            <div className="next-class-actions">
              {dashboard.nextSession.meetingUrl ? (
                <a href={dashboard.nextSession.meetingUrl} target="_blank" rel="noreferrer">
                  <VideoCamera aria-hidden="true" /> เปิดห้องสอน
                </a>
              ) : (
                <span className="meeting-pending">ยังไม่กำหนดห้องสอน</span>
              )}
              <Link href={`/teach/cohorts/${dashboard.nextSession.cohortId}`}>
                ดูรายละเอียดคาบสอน <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="next-class empty-teach-state">
          <ChalkboardTeacher aria-hidden="true" />
          <div><h2>ยังไม่มีคาบสอนถัดไป</h2><p>เมื่อแอดมินมอบหมายรุ่นเรียน ตารางจะปรากฏที่นี่</p></div>
        </section>
      )}

      <div className="teach-overview-grid">
        <section className="teaching-queue" aria-labelledby="teaching-queue-title">
          <h2 id="teaching-queue-title">สิ่งที่ต้องดูแลวันนี้</h2>
          <div>
            {dashboard.queue.map((item) => (
              <Link href={item.href} key={`${item.kind}-${item.label}`}>
                <span><QueueIcon kind={item.kind} /></span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                <CaretRight aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link className="teach-section-link" href="/teach#all-tasks">ดูทั้งหมด <ArrowRight /></Link>
        </section>

        <section className="assigned-courses" id="courses" aria-labelledby="assigned-courses-title">
          <h2 id="assigned-courses-title">คอร์สที่รับผิดชอบ</h2>
          <div className="assigned-course-head" aria-hidden="true">
            <span>คอร์ส / รุ่น</span><span>ความคืบหน้า</span><span>คาบถัดไป</span><span />
          </div>
          {dashboard.cohorts.map((cohort) => (
            <article className="assigned-course-row" key={cohort.id}>
              <Image src={cohort.coverUrl} alt="" width={104} height={64} />
              <div className="assigned-course-title">
                <h3>{cohort.title}</h3>
                <p>ผู้เรียน {cohort.learnerCount} คน</p>
              </div>
              <div className="assigned-course-progress">
                <span>บทที่ {cohort.completedModules} / {cohort.totalModules}</span>
                <div><i style={{ width: `${cohort.progressPercent}%` }} /></div>
                <small>{cohort.progressPercent}%</small>
              </div>
              <div className="assigned-course-date">
                <span><CalendarBlank aria-hidden="true" /> {shortDate.format(cohort.nextSessionAt)}</span>
                <span><Clock aria-hidden="true" /> {time.format(cohort.nextSessionAt)} น.</span>
              </div>
              <Link href={`/teach/cohorts/${cohort.id}`} aria-label={`เปิด ${cohort.title}`}>
                <CaretRight aria-hidden="true" />
              </Link>
            </article>
          ))}
          <Link className="teach-section-link" href="/teach#courses">ดูคอร์สทั้งหมด <ArrowRight /></Link>
        </section>
      </div>
    </main>
  );
}
