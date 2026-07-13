import { CompletionBoard } from "@/components/admin/completion-board";
import { getCurrentMember } from "@/lib/auth/session";
import { getAdminCompletionCandidates } from "@/lib/data/read-model";

export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  const [candidates, member] = await Promise.all([
    getAdminCompletionCandidates(),
    getCurrentMember(),
  ]);
  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CERTIFICATES</p>
          <h1>ประเมิน อนุมัติ และออกใบประกาศ</h1>
          <p>ระบบคำนวณเกณฑ์ 100 / 80 / 70 และเก็บ audit trail ทุกครั้ง</p>
        </div>
      </div>
      <CompletionBoard candidates={candidates} demo={Boolean(member?.demo)} />
    </main>
  );
}
