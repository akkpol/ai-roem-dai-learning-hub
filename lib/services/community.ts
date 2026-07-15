import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  cohortAnnouncements,
  cohortInstructors,
  cohortThreadReplies,
  cohortThreads,
  enrollments,
} from "@/db/schema";
import { AuthorizationError, requireMember } from "@/lib/auth/authorization";
import { hasRole } from "@/lib/auth/roles";
import {
  assertCommunityAccess,
  assertThreadReplyable,
  canModerateCommunity,
} from "@/lib/domain/community";
import { learningStudioFlags } from "@/lib/feature-flags";

const uuid = z.string().uuid();

async function communityScope(cohortId: string) {
  if (!learningStudioFlags.community) throw new Error("ชุมชนของรุ่นเรียนยังไม่เปิดใช้งาน");
  const member = await requireMember();
  if (member.demo) {
    return { member, enrolled: true, assignedInstructor: true, admin: true };
  }
  const db = getDb();
  const [[enrollment], [assignment]] = await Promise.all([
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.cohortId, cohortId),
          eq(enrollments.userId, member.userId),
          eq(enrollments.status, "active"),
        ),
      )
      .limit(1),
    db
      .select({ cohortId: cohortInstructors.cohortId })
      .from(cohortInstructors)
      .where(
        and(
          eq(cohortInstructors.cohortId, cohortId),
          eq(cohortInstructors.userId, member.userId),
        ),
      )
      .limit(1),
  ]);
  const scope = {
    member,
    enrolled: Boolean(enrollment),
    assignedInstructor: Boolean(assignment),
    admin: hasRole(member.roles, "admin"),
  };
  assertCommunityAccess(scope);
  return scope;
}

function assertModerator(scope: Awaited<ReturnType<typeof communityScope>>) {
  if (!canModerateCommunity(scope)) {
    throw new AuthorizationError("เฉพาะผู้สอนที่ได้รับมอบหมายหรือแอดมินเท่านั้นที่จัดการชุมชนได้");
  }
}

export async function createAnnouncement(input: {
  cohortId: string;
  title: string;
  body: string;
  pinned?: boolean;
}) {
  const parsed = z.object({
    cohortId: uuid,
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(3).max(5000),
    pinned: z.boolean().optional(),
  }).parse(input);
  const scope = await communityScope(parsed.cohortId);
  assertModerator(scope);
  const [created] = await getDb().insert(cohortAnnouncements).values({
    ...parsed,
    authorUserId: scope.member.userId,
  }).returning();
  return created;
}

export async function createThread(input: {
  cohortId: string;
  title: string;
  body: string;
}) {
  const parsed = z.object({
    cohortId: uuid,
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(3).max(5000),
  }).parse(input);
  const scope = await communityScope(parsed.cohortId);
  const [created] = await getDb().insert(cohortThreads).values({
    ...parsed,
    authorUserId: scope.member.userId,
  }).returning();
  return created;
}

export async function replyToThread(input: { threadId: string; body: string }) {
  const parsed = z.object({ threadId: uuid, body: z.string().trim().min(1).max(5000) }).parse(input);
  const [thread] = await getDb().select().from(cohortThreads).where(eq(cohortThreads.id, parsed.threadId)).limit(1);
  if (!thread) throw new Error("ไม่พบกระทู้");
  assertThreadReplyable(thread.status);
  const scope = await communityScope(thread.cohortId);
  const [created] = await getDb().insert(cohortThreadReplies).values({
    threadId: thread.id,
    authorUserId: scope.member.userId,
    body: parsed.body,
  }).returning();
  await getDb().update(cohortThreads).set({ updatedAt: new Date() }).where(eq(cohortThreads.id, thread.id));
  return created;
}

export async function moderateThread(input: {
  threadId: string;
  action: "pin" | "unpin" | "resolve" | "reopen" | "lock";
}) {
  const parsed = z.object({
    threadId: uuid,
    action: z.enum(["pin", "unpin", "resolve", "reopen", "lock"]),
  }).parse(input);
  const [thread] = await getDb().select().from(cohortThreads).where(eq(cohortThreads.id, parsed.threadId)).limit(1);
  if (!thread) throw new Error("ไม่พบกระทู้");
  const scope = await communityScope(thread.cohortId);
  assertModerator(scope);
  const now = new Date();
  const set = parsed.action === "pin"
    ? { pinned: true, updatedAt: now }
    : parsed.action === "unpin"
      ? { pinned: false, updatedAt: now }
      : parsed.action === "resolve"
        ? { status: "resolved" as const, resolvedAt: now, lockedAt: null, updatedAt: now }
        : parsed.action === "reopen"
          ? { status: "open" as const, resolvedAt: null, lockedAt: null, updatedAt: now }
          : { status: "locked" as const, lockedAt: now, updatedAt: now };
  const [updated] = await getDb().update(cohortThreads).set(set).where(eq(cohortThreads.id, thread.id)).returning();
  await getDb().insert(auditLogs).values({
    actorUserId: scope.member.userId,
    action: `community.thread.${parsed.action}`,
    entityType: "cohort_thread",
    entityId: thread.id,
  });
  return updated;
}
