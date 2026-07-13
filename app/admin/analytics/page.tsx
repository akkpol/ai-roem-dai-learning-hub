import { KpiScorecard } from "@/components/admin/kpi-scorecard";
import { getBetaScorecard } from "@/lib/data/read-model";

export default async function AnalyticsPage() {
  const scorecard = await getBetaScorecard();
  return <main className="admin-main"><div className="page-heading"><div><p className="eyebrow">WEEKLY SCORECARD</p><h1>Closed Beta analytics</h1><p>Outcome, drivers และ guardrails ใช้นิยามเดียวกับข้อมูลใน Neon</p></div></div><KpiScorecard scorecard={scorecard} /></main>;
}
