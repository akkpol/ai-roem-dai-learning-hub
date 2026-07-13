"use client";

import { useState } from "react";
import { setCertificateVisibilityAction } from "@/app/actions/certificates";

export function CertificateActions({
  certificateId,
  shareSlug,
  initialPublic,
  demo,
}: {
  certificateId: string;
  shareSlug: string;
  initialPublic: boolean;
  demo: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/certificates/${shareSlug}`);
    setCopied(true);
  }

  return (
    <div className="certificate-actions">
      {demo ? (
        <button type="button" onClick={() => setIsPublic((value) => !value)}>{isPublic ? "เปลี่ยนเป็น Private" : "เปิด Public verification"}</button>
      ) : (
        <form action={setCertificateVisibilityAction}>
          <input type="hidden" name="certificateId" value={certificateId} />
          <input type="hidden" name="publicVerificationEnabled" value={String(!isPublic)} />
          <button type="submit">{isPublic ? "เปลี่ยนเป็น Private" : "เปิด Public verification"}</button>
        </form>
      )}
      <button type="button" onClick={copyLink} disabled={!isPublic}>{copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์แชร์"}</button>
      <a href={`/api/certificates/${certificateId}/pdf`}>ดาวน์โหลด PDF</a>
    </div>
  );
}
