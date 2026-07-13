import { eq } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import { profiles } from "@/db/schema";
import { getNeonAuth, isLocalDemoMode } from "./server";

export type AppMember = {
  userId: string;
  email: string;
  displayName: string;
  role: "student" | "instructor" | "admin";
  emailVerified: boolean;
  demo: boolean;
};

const demoMember: AppMember = {
  userId: "demo-admin",
  email: "beta@ai-roem-dai.local",
  displayName: "ทีม AI เริ่มได้",
  role: "admin",
  emailVerified: true,
  demo: true,
};

export async function getCurrentMember(): Promise<AppMember | null> {
  const auth = getNeonAuth();
  if (!auth) {
    return isLocalDemoMode() ? demoMember : null;
  }

  const { data, error } = await auth.getSession();
  if (error || !data?.user) {
    return null;
  }

  if (!hasDatabaseConnection()) {
    return {
      userId: data.user.id,
      email: data.user.email,
      displayName: data.user.name || data.user.email,
      role: "student",
      emailVerified: data.user.emailVerified,
      demo: false,
    };
  }

  const [profile] = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, data.user.id))
    .limit(1);

  if (!profile) {
    const role =
      process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() === data.user.email.toLowerCase()
        ? "admin"
        : "student";
    const [created] = await getDb()
      .insert(profiles)
      .values({
        userId: data.user.id,
        email: data.user.email,
        emailVerifiedAt: data.user.emailVerified ? new Date() : null,
        displayName: data.user.name || data.user.email,
        avatarUrl: data.user.image,
        role,
      })
      .onConflictDoNothing({ target: profiles.userId })
      .returning();
    return {
      userId: data.user.id,
      email: data.user.email,
      displayName: created?.displayName ?? data.user.name ?? data.user.email,
      role: created?.role ?? role,
      emailVerified: data.user.emailVerified,
      demo: false,
    };
  }

  return {
    userId: data.user.id,
    email: data.user.email,
    displayName: profile.displayName,
    role: profile.role,
    emailVerified: data.user.emailVerified,
    demo: false,
  };
}
