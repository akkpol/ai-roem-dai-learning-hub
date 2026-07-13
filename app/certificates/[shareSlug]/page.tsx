import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { PrintButton } from "@/components/print-button";
import { getPublicCertificate } from "@/lib/data/read-model";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ shareSlug: string }> }): Promise<Metadata> {
  const certificate = await getPublicCertificate((await params).shareSlug);
  return { title: certificate ? `ใบประกาศ ${certificate.learnerName}` : "ไม่พบใบประกาศ", robots: { index: false, follow: false } };
}

export default async function PublicCertificatePage({ params }: { params: Promise<{ shareSlug: string }> }) {
  const certificate = await getPublicCertificate((await params).shareSlug);
  if (!certificate) notFound();
  return (
    <main className="verification-page">
      <div className="verification-toolbar"><Link href="/">AI เริ่มได้</Link><PrintButton /></div>
      <article className="verification-certificate">
        <SealCheck weight="duotone" />
        <p className="eyebrow">VERIFIED CERTIFICATE</p>
        <h1>ใบประกาศการจบหลักสูตร</h1>
        <p>ขอมอบใบประกาศนี้ให้แก่</p>
        <h2>{certificate.learnerName}</h2>
        <p>เพื่อรับรองว่าได้ผ่านเกณฑ์หลักสูตร</p>
        <h3>{certificate.courseTitle}</h3>
        <div className="verification-details"><span>ผู้สอน <b>{certificate.instructorName}</b></span><span>วันที่จบ <b>{certificate.completedAt.toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" })}</b></span></div>
        <footer><CheckCircle weight="fill" /> ตรวจสอบแล้ว · {certificate.certificateCode} · {certificate.templateVersion}</footer>
      </article>
    </main>
  );
}
