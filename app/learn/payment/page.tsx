import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { getCurrentMember } from "@/lib/auth/session";
import { getLearnerPaymentStatus } from "@/lib/data/learner-studio-read-model";

export default async function LearnerPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in?next=/learn/payment");
  const { session_id: sessionId = "" } = await searchParams;
  const payment = await getLearnerPaymentStatus(sessionId, member.userId, member.demo);
  const paid = payment?.status === "paid";
  const failed = payment?.status === "payment_failed" || payment?.status === "expired";
  return <AppShell active="learn"><main className="payment-status-page"><section>{paid ? <CheckCircle className="payment-success-icon" aria-hidden="true" /> : failed ? <WarningCircle className="payment-failed-icon" aria-hidden="true" /> : <Clock aria-hidden="true" />}<p className="eyebrow">PAYMENT STATUS</p><h1>{paid ? "ชำระเงินและยืนยันสิทธิ์แล้ว" : failed ? "ยังยืนยันการชำระเงินไม่ได้" : "กำลังรอ webhook ยืนยัน"}</h1>{payment ? <><p>{payment.courseTitle} · {payment.cohortTitle}</p><strong>฿{(payment.amount / 100).toLocaleString("th-TH")}</strong></> : <p>ไม่พบ Checkout Session ของบัญชีนี้</p>}<small>หน้านี้แสดงสถานะเท่านั้น ระบบสร้าง enrollment หลังตรวจลายเซ็น ยอดเงิน และสกุลเงินจาก Stripe webhook แล้วเท่านั้น</small><Link href="/learn">กลับไปการเรียนของฉัน</Link></section></main></AppShell>;
}
