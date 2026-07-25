import Link from "next/link";

import { FieldDescription } from "@/components/ui/field";
import type { GoogleOAuthDisclosure } from "@/modules/identity";

export function GooglePolicyDisclosure({
  disclosure,
  className,
}: {
  disclosure: GoogleOAuthDisclosure;
  className?: string;
}) {
  return (
    <FieldDescription className={className}>
      {"เมื่อดำเนินการต่อ คุณยอมรับ"}
      <Link href={disclosure.termsUrl}>ข้อกำหนดการใช้งาน</Link>
      {"และ"}
      <Link href={disclosure.privacyUrl}>นโยบายความเป็นส่วนตัว</Link>
      {"ฉบับปัจจุบัน"}
    </FieldDescription>
  );
}
