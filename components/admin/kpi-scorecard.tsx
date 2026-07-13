type Scorecard = Awaited<ReturnType<typeof import("@/lib/data/read-model").getBetaScorecard>>;

function metric(value: number | null, suffix = "%") {
  return value === null ? "—" : `${value}${suffix}`;
}

export function KpiScorecard({ scorecard }: { scorecard: Scorecard }) {
  return (
    <div className="kpi-layout">
      <section className="kpi-group">
        <p className="eyebrow">PRIMARY KPIs</p>
        <div className="metric-grid primary-metrics">
          <article><span>Threshold attainment</span><strong>{metric(scorecard.thresholdAttainmentRate)}</strong><small>รุ่นที่ถึงขั้นต่ำก่อน deadline</small></article>
          <article><span>Median days to threshold</span><strong>{metric(scorecard.medianDaysToThreshold, " วัน")}</strong><small>จากวันเปิดรับถึงวันที่ครบขั้นต่ำ</small></article>
          <article><span>Qualified completion</span><strong>{metric(scorecard.qualifiedCompletionRate)}</strong><small>ผู้เรียนที่ผ่านเกณฑ์ 100/80/70</small></article>
        </div>
      </section>
      <section className="kpi-group">
        <p className="eyebrow">DRIVERS</p>
        <div className="metric-grid compact-metrics">
          <article><span>Invite acceptance</span><strong>{metric(scorecard.inviteAcceptanceRate)}</strong></article>
          <article><span>Reservation conversion</span><strong>{metric(scorecard.reservationConversionRate)}</strong></article>
          <article><span>Withdrawal</span><strong>{metric(scorecard.withdrawalRate)}</strong></article>
          <article><span>Waitlist conversion</span><strong>{metric(scorecard.waitlistConversionRate)}</strong></article>
        </div>
      </section>
      <section className="kpi-group">
        <p className="eyebrow">GUARDRAILS</p>
        <div className="guardrail-list">
          <span>ยกเลิกหลังยืนยัน <b>{metric(scorecard.confirmedCohortCancellationRate)}</b></span>
          <span>เปิดต่ำกว่าเกณฑ์ <b>{scorecard.belowThresholdConfirmations}</b></span>
          <span>OTP / Email fail <b>{scorecard.otpOrEmailFailures}</b></span>
          <span>Unauthorized <b>{scorecard.unauthorizedAccessAttempts}</b></span>
          <span>Access fail <b>{scorecard.protectedAccessFailures}</b></span>
          <span>Certificate fail <b>{scorecard.certificateGenerationFailures}</b></span>
        </div>
      </section>
      <div className="target-readiness" data-ready={scorecard.readyForTargets}>
        {scorecard.readyForTargets
          ? "มีข้อมูลถึงเกณฑ์สำหรับเริ่มทบทวน target แบบมีหลักฐานแล้ว"
          : "ยังไม่ตั้ง target ตายตัว — รออย่างน้อย 2 รุ่นหรือ 100 invitations"}
      </div>
    </div>
  );
}
