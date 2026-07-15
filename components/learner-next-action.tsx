"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarCheck, CreditCard } from "@phosphor-icons/react";
import { startCheckoutAction } from "@/app/actions/checkout";
import type { LearnerNextActionView } from "@/lib/data/learner-studio-read-model";

function remainingLabel(dueAt: Date | null, now: number) {
  if (!dueAt) return null;
  const remaining = dueAt.getTime() - now;
  if (remaining <= 0) return "หมดเวลาแล้ว";
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `เหลือ ${hours} ชม. ${minutes} นาที`;
}

export function LearnerNextAction({ action, demo }: { action: LearnerNextActionView; demo: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [demoPaid, setDemoPaid] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!action) return null;
  const countdown = remainingLabel(action.dueAt, now);
  const payment = action.kind === "payment";
  return (
    <section className="learner-next-action" aria-labelledby="learner-next-action-title">
      <span>{payment ? <CreditCard aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}</span>
      <div><p>สิ่งที่ควรทำถัดไป</p><h2 id="learner-next-action-title">{demoPaid ? "ชำระเงินเรียบร้อยแล้ว" : action.title}</h2><small>{action.detail}</small>{countdown && payment && !demoPaid && <strong>{countdown}</strong>}</div>
      {payment && action.reservationId ? (
        demo ? <button type="button" onClick={() => setDemoPaid(true)} disabled={demoPaid}>{demoPaid ? "รอ webhook ยืนยัน" : `ชำระ ฿${((action.amount ?? 0) / 100).toLocaleString("th-TH")}`}</button> : <form action={startCheckoutAction}><input type="hidden" name="reservationId" value={action.reservationId} /><button type="submit">ไปที่ Stripe Checkout <ArrowRight /></button></form>
      ) : <Link href={action.href}>เปิดรายการ <ArrowRight /></Link>}
    </section>
  );
}
