import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import GoogleSignInErrorPage from "@/app/(auth)/sign-in/google-error/page";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import SignUpPage from "@/app/(auth)/sign-up/page";
import VerifyEmailPage from "@/app/(auth)/verify-email/page";
import { GoogleSignInForm } from "@/app/(auth)/_components/google-sign-in-form";
import LoginPage from "@/app/login/page";
import { LoginForm } from "@/components/login-form";

const render = (Page: ComponentType) => renderToStaticMarkup(createElement(Page));

describe("Public authentication pages", () => {
  it.each([
    [SignUpPage, "สร้างบัญชี"],
    [LoginPage, "เข้าสู่ระบบ"],
    [ForgotPasswordPage, "ลืมรหัสผ่าน"],
    [VerifyEmailPage, "ยืนยันอีเมล"],
  ])("renders an accessible Thai page", (Page, heading) => {
    expect(render(Page)).toContain(heading);
  });

  it("uses safe credential autocomplete and policy acceptance without an age gate", () => {
    const signup = render(SignUpPage);
    expect(signup).toContain('autoComplete="email"');
    expect(signup).toContain('autoComplete="new-password"');
    expect(signup).not.toContain("อายุ 18 ปีขึ้นไป");
    expect(signup).not.toContain('name="ageAttested"');
    expect(signup).toContain("ข้อกำหนดการใช้งาน");
    expect(signup).not.toContain("TOTP");
    expect(signup).not.toContain("อุปกรณ์ที่เข้าสู่ระบบ");
  });

  it("offers the same safe deletion-cancellation entry after every sign-in failure", () => {
    const signIn = render(LoginPage);
    expect(signIn).toContain("/account/privacy?mode=cancel-deletion");
    expect(signIn).toContain("ยกเลิกคำขอลบบัญชี");
    expect(signIn).not.toContain("บัญชีของคุณอยู่ระหว่างลบ");
  });

  it("offers one Google action for both new and existing accounts", () => {
    const google = renderToStaticMarkup(
      createElement(GoogleSignInForm, { enabled: true }),
    );

    expect(google).toContain('action="/api/auth/google"');
    expect(google).toContain('method="post"');
    expect(google).toContain("ดำเนินการต่อด้วย Google");
    expect(
      renderToStaticMarkup(
        createElement(LoginForm, { googleEnabled: true }),
      ),
    ).toContain(
      "เมื่อดำเนินการต่อ คุณยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวฉบับปัจจุบัน",
    );
    expect(
      renderToStaticMarkup(
        createElement(GoogleSignInForm, { enabled: false }),
      ),
    ).toBe("");
  });

  it("uses a generic OAuth failure page without exposing provider details", () => {
    const errorPage = render(GoogleSignInErrorPage);

    expect(errorPage).toContain("ดำเนินการต่อด้วย Google ไม่สำเร็จ");
    expect(errorPage).toContain("/login");
    expect(errorPage).not.toContain("client_secret");
    expect(errorPage).not.toContain("state=");
  });

  it("initializes reset from the emailed query token without a manual token field", async () => {
    const reset = renderToStaticMarkup(
      await ResetPasswordPage({
        searchParams: Promise.resolve({ token: "email-link-token" }),
      }),
    );

    expect(reset).toContain("ตั้งรหัสผ่านใหม่");
    expect(reset).toContain('name="token"');
    expect(reset).toContain('type="hidden"');
    expect(reset).toContain('value="email-link-token"');
    expect(reset).not.toContain("รหัสยืนยัน");
  });

  it("fails closed when the reset link has no token", async () => {
    const reset = renderToStaticMarkup(
      await ResetPasswordPage({ searchParams: Promise.resolve({}) }),
    );

    expect(reset).toContain("ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง");
    expect(reset).not.toContain("<form");
  });
});
