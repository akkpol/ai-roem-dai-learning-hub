import { eq } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import { memberRoles, profiles } from "@/db/schema";
import { resolveMemberRoles, type MemberRole } from "./roles";
import { getNeonAuth, isLocalDemoMode } from "./server";

export type AppMember = {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roles: MemberRole[];
  emailVerified: boolean;
  demo: boolean;
};

const demoMember: AppMember = {
  userId: "demo-admin",
  email: "beta@ai-roem-dai.local",
  displayName: "กาญจนา",
  avatarUrl: "/images/avatar-kanyaporn.webp",
  roles: ["student", "instructor", "admin"],
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
    return null;
  }

  const [profile] = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, data.user.id))
    .limit(1);

  if (!profile) {
    const legacyRole: MemberRole =
      process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() === data.user.email.toLowerCase()
        ? "admin"
        : "student";
    const db = getDb();
    await db
      .insert(profiles)
      .values({
        userId: data.user.id,
        email: data.user.email,
        emailVerifiedAt: data.user.emailVerified ? new Date() : null,
        displayName: data.user.name || data.user.email,
        avatarUrl: data.user.image,
        role: legacyRole,
      })
      .onConflictDoNothing({ target: profiles.userId });
    const initialRoles: MemberRole[] =
      legacyRole === "admin" ? ["student", "admin"] : ["student"];
    await db
      .insert(memberRoles)
      .values(initialRoles.map((role) => ({ userId: data.user.id, role })))
      .onConflictDoNothing();
    const [created] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, data.user.id))
      .limit(1);
    return {
      userId: data.user.id,
      email: data.user.email,
      displayName: created?.displayName ?? data.user.name ?? data.user.email,
      avatarUrl: created?.avatarUrl ?? data.user.image ?? null,
      roles: initialRoles,
      emailVerified: data.user.emailVerified,
      demo: false,
    };
  }

  const expandedRoles = await getDb()
    .select({ role: memberRoles.role })
    .from(memberRoles)
    .where(eq(memberRoles.userId, data.user.id));

  return {
    userId: data.user.id,
    email: data.user.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    roles: resolveMemberRoles(
      expandedRoles.map((row) => row.role),
      profile.role,
    ),
    emailVerified: data.user.emailVerified,
    demo: false,
  };
}
