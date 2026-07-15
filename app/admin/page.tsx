import Link from "next/link";
import { ArrowRight, CheckSquare, CreditCard, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { getCurrentMember } from "@/lib/auth/session";
import { getPaymentAdminData } from "@/lib/data/admin-studio-read-model";
import { getCourseReviewQueue } from "@/lib/data/course-studio-read-model";
import { getAdminCohorts, getBetaScorecard, getInviteSummary } from "@/lib/data/read-model";

export default async function AdminPage() {
  const member = await getCurrentMember();
  const demo = Boolean(member?.demo);
  const [cohorts, scorecard, invites, reviews, payments] = await Promise.all([
    getAdminCohorts(),
    getBetaScorecard(),
    getInviteSummary(),
    getCourseReviewQueue(demo),
    getPaymentAdminData(demo),
  ]);
  const decisionCohorts = cohorts.filter((cohort) =>
    ["threshold_met", "payment_collecting", "postponed"].includes(cohort.status),
  );
  const refundQueue = payments.refunds.filter((refund) =>
    ["requested", "approved", "failed"].includes(refund.status),
  );
  const reservationCount = invites.reduce((total, item) => total + Number(item.accepted), 0);
  const paidOrderCount = payments.orders.filter((order) => order.status === "paid").length;

  return (
    <main className="admin-main admin-decision-home">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DECISION WORKSPACE</p>
          <h1>สิ่งที่ต้องตัดสินใจวันนี้</h1>
          <p>รวม revision, รุ่นเรียน และ payment exception ที่ต้องมีเจ้าของดำเนินการ</p>
        </div>
      </div>

      <section className="admin-decision-list" aria-labelledby="decision-queue-title">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">NEEDS ATTENTION</p>
            <h2 id="decision-queue-title">คิวตัดสินใจ</h2>
          </div>
          <span>{reviews.length + decisionCohorts.length + refundQueue.length} รายการ</span>
        </div>

        {reviews.slice(0, 2).map((review) => (
          <article key={review.id}>
            <span className="admin-decision-icon"><CheckSquare aria-hidden="true" /></span>
            <div>
              <strong>ตรวจ Course revision #{review.revisionNumber}</strong>
              <span>{review.courseTitle}</span>
            </div>
            <span className="status-badge" data-status="threshold_met">รอตรวจ</span>
            <Link href="/admin/reviews" aria-label={`เปิด revision ${review.courseTitle}`}><ArrowRight aria-hidden="true" /></Link>
          </article>
        ))}

        {decisionCohorts.slice(0, 2).map((cohort) => (
          <article key={cohort.id}>
            <span className="admin-decision-icon"><UsersThree aria-hidden="true" /></span>
            <div>
              <strong>{cohort.title}</strong>
              <span>{cohort.status === "threshold_met" ? "ถึงขั้นต่ำแล้ว รอเปิดรอบชำระเงิน" : cohort.status === "payment_collecting" ? "กำลังรับชำระ ตรวจยอดก่อนยืนยันรุ่น" : "ต้องกำหนด fallback date"}</span>
            </div>
            <span className="status-badge" data-status={cohort.status}>{cohort.status}</span>
            <Link href="/admin/cohorts" aria-label={`เปิดรุ่น ${cohort.title}`}><ArrowRight aria-hidden="true" /></Link>
          </article>
        ))}

        {refundQueue.slice(0, 2).map((refund) => (
          <article key={refund.id}>
            <span className="admin-decision-icon"><CreditCard aria-hidden="true" /></span>
            <div>
              <strong>คืนเงินเต็มจำนวนให้ {refund.learner}</strong>
              <span>฿{(refund.amount / 100).toLocaleString("th-TH")} · {refund.reason}</span>
            </div>
            <span className="status-badge" data-status={refund.status}>{refund.status}</span>
            <Link href="/admin/payments" aria-label={`เปิด refund ของ ${refund.learner}`}><ArrowRight aria-hidden="true" /></Link>
          </article>
        ))}

        {reviews.length + decisionCohorts.length + refundQueue.length === 0 && (
          <p className="admin-empty-decision">ไม่มีรายการเร่งด่วนในขณะนี้</p>
        )}
      </section>

      <section className="admin-funnel" aria-labelledby="admin-funnel-title">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">LEARNING JOURNEY</p>
            <h2 id="admin-funnel-title">Reservation to completion funnel</h2>
          </div>
          <Link href="/admin/analytics">ดูรายละเอียด <ArrowRight aria-hidden="true" /></Link>
        </div>
        <ol>
          <li><span>01 · Reservation</span><strong>{reservationCount}</strong><small>ผู้ตอบรับคำเชิญ</small></li>
          <li><span>02 · Payment</span><strong>{paidOrderCount}</strong><small>order ชำระแล้ว</small></li>
          <li><span>03 · Completion</span><strong>{scorecard.qualifiedCompletionRate ?? "—"}%</strong><small>ผ่านเกณฑ์จบหลักสูตร</small></li>
        </ol>
      </section>
    </main>
  );
}
