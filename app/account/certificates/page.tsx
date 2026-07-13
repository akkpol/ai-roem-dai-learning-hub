import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Certificate } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { CertificateActions } from "@/components/certificate-actions";
import { getCurrentMember } from "@/lib/auth/session";
import { getMemberCertificates } from "@/lib/data/read-model";

export const metadata: Metadata = { title: "ใบประกาศของฉัน" };
export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in?next=/account/certificates");
  const certificates = await getMemberCertificates(member.userId, member.demo);
  return (
    <AppShell active="certificates">
      <main className="portal-main certificates-page">
        <div className="page-heading"><div><p className="eyebrow">MY CERTIFICATES</p><h1>ใบประกาศของฉัน</h1><p>ดาวน์โหลด พิมพ์ และเลือกเปิด public verification ได้ด้วยตัวเอง</p></div></div>
        <div className="certificate-list">
          {certificates.map((certificate) => (
            <article className="certificate-card" key={certificate.id}>
              <div className="certificate-icon"><Certificate weight="duotone" /></div>
              <div><span>{certificate.certificateCode}</span><h2>{certificate.courseTitle}</h2><p>ออกให้ {certificate.learnerName} · {certificate.completedAt.toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" })}</p><small>ค่าเริ่มต้นเป็น Private · template {certificate.templateVersion}</small></div>
              <CertificateActions certificateId={certificate.id} shareSlug={certificate.shareSlug} initialPublic={certificate.publicVerificationEnabled} demo={member.demo} />
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
