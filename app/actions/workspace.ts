"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/authorization";
import { roleLandingPath, type MemberRole } from "@/lib/auth/roles";

export async function switchWorkspace(role: MemberRole) {
  await requireRole(role);
  const cookieStore = await cookies();
  cookieStore.set("preferred_workspace", role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect(roleLandingPath(role));
}
