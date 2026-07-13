import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isAuthConfigured } from "@/lib/auth/server";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/learn";
  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/">AI เริ่มได้</Link>
      <SignInForm configured={isAuthConfigured()} nextPath={nextPath} />
    </main>
  );
}
