import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProfilePage from "@/app/(account)/account/profile/page";
import PrivacyPage from "@/app/(account)/account/privacy/page";
import SecurityPage from "@/app/(account)/account/security/page";
import TwoFactorPage from "@/app/(auth)/two-factor/page";

describe("SESSION-004 Thai account pages", () => {
  it("renders the approved profile fields and no email editor", () => {
    const html = renderToStaticMarkup(ProfilePage());
    expect(html).toContain("โปรไฟล์ของฉัน");
    expect(html).toContain('name="displayName"');
    expect(html).toContain('name="locale"');
    expect(html).toContain('name="timeZone"');
    expect(html).not.toContain('name="email"');
  });

  it("renders device, password, TOTP and recovery controls", () => {
    const html = renderToStaticMarkup(SecurityPage());
    expect(html).toContain("อุปกรณ์และเซสชัน");
    expect(html).toContain("เปลี่ยนรหัสผ่าน");
    expect(html).toContain("แอปยืนยันตัวตน");
    expect(html).toContain("รหัสกู้คืน");
  });

  it("renders export, policy history and deletion controls", () => {
    const html = renderToStaticMarkup(PrivacyPage());
    expect(html).toContain("ประวัตินโยบาย");
    expect(html).toContain("ดาวน์โหลดข้อมูล Identity");
    expect(html).toContain("ขอลบบัญชี");
    expect(html).toContain("ยกเลิกการลบบัญชี");
  });

  it("renders TOTP and one-time recovery sign-in choices", () => {
    const html = renderToStaticMarkup(TwoFactorPage());
    expect(html).toContain("ยืนยันตัวตนสองขั้นตอน");
    expect(html).toContain('name="totpCode"');
    expect(html).toContain('name="recoveryCode"');
  });

  it("composes account controls from the React Aria shadcn foundation", () => {
    const source = readFileSync(
      "src/app/(account)/account/_components/account-forms.tsx",
      "utf8",
    );
    expect(source).toContain('from "@/components/ui/field"');
    expect(source).toContain('from "@/components/ui/card"');
    expect(source).toContain('from "@/components/ui/alert-dialog"');
    expect(source).toContain('"password" | "verify" | "recovery"');
    expect(source).not.toMatch(/<button\b|<input\b|<select\b|<label\b/);
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toContain("account.css");
  });
});
