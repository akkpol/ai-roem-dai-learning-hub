import { issueRefundAction } from "@/app/actions/checkout";
import { getCurrentMember } from "@/lib/auth/session";
import { getPaymentAdminData } from "@/lib/data/admin-studio-read-model";

export default async function AdminPaymentsPage() {
  const member = await getCurrentMember();
  const data = await getPaymentAdminData(Boolean(member?.demo));
  return <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">PAYMENT EXCEPTIONS</p><h1>การชำระเงินและคืนเงิน</h1><p>ตรวจ order ผิดปกติ, late payment และ full-refund queue จากที่เดียว</p></div></div><section className="payment-admin-list"><h2>Orders</h2>{data.orders.map((order) => <article key={order.id}><div><strong>{order.learner}</strong><span>{order.cohortTitle}</span></div><span>฿{(order.amount / 100).toLocaleString("th-TH")}</span><span data-status={order.status}>{order.status}</span><time>{order.deadline.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</time></article>)}</section><section className="payment-admin-list"><h2>Refund queue</h2>{data.refunds.map((refund) => <article key={refund.id}><div><strong>{refund.learner}</strong><span>{refund.reason}</span></div><span>฿{(refund.amount / 100).toLocaleString("th-TH")}</span><span data-status={refund.status}>{refund.status}</span>{refund.status === "approved" && <form action={issueRefundAction}><input type="hidden" name="refundId" value={refund.id} /><button type="submit">ดำเนินการคืนเต็มจำนวน</button></form>}</article>)}</section></main>;
}
