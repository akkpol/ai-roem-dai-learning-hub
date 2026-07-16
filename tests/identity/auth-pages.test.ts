import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import SignInPage from "@/app/(auth)/sign-in/page";
import SignUpPage from "@/app/(auth)/sign-up/page";
import VerifyEmailPage from "@/app/(auth)/verify-email/page";

const render = (Page: ComponentType) => renderToStaticMarkup(createElement(Page));

describe("Public authentication pages", () => {
  it.each([
    [SignUpPage, "สร้างบัญชี"],
    [SignInPage, "เข้าสู่ระบบ"],
    [ForgotPasswordPage, "ลืมรหัสผ่าน"],
    [ResetPasswordPage, "ตั้งรหัสผ่านใหม่"],
    [VerifyEmailPage, "ยืนยันอีเมล"],
  ])("renders an accessible Thai page", (Page, heading) => {
    expect(render(Page)).toContain(heading);
  });

  it("uses safe credential autocomplete and explicit signup attestations", () => {
    const signup = render(SignUpPage);
    expect(signup).toContain('autoComplete="email"');
    expect(signup).toContain('autoComplete="new-password"');
    expect(signup).toContain("อายุ 18 ปีขึ้นไป");
    expect(signup).toContain("ข้อกำหนดการใช้งาน");
    expect(signup).not.toContain("TOTP");
    expect(signup).not.toContain("อุปกรณ์ที่เข้าสู่ระบบ");
  });
});
