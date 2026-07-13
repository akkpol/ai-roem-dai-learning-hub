import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertSafeTestDatabase } from "@/lib/testing/database-safety";

const authState = vi.hoisted(() => ({
  member: {
    userId: "user-a",
    email: "a@example.com",
    displayName: "User A",
    role: "student" as const,
    emailVerified: true,
    demo: false,
  },
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireMember: async () => authState.member,
  requireAdmin: async () => ({ ...authState.member, userId: "admin", email: "admin@example.com", role: "admin" as const }),
}));

const databaseUrl = process.env.TEST_DATABASE_URL;
const runDatabaseTests = Boolean(databaseUrl);
const COURSE_ID = "10000000-0000-4000-8000-000000000001";
const COHORT_ID = "20000000-0000-4000-8000-000000000001";
const FALLBACK_ID = "20000000-0000-4000-8000-000000000002";

describe.skipIf(!runDatabaseTests)("Closed Beta database integration", () => {
  let adminClient: Client;

  beforeAll(async () => {
    assertSafeTestDatabase(
      databaseUrl!,
      process.env.CONFIRM_DESTRUCTIVE_TEST_DATABASE,
    );
    process.env.DATABASE_URL = databaseUrl;
    adminClient = new Client({ connectionString: databaseUrl });
    await adminClient.connect();
    await adminClient.query("drop schema if exists public cascade; create schema public");
    const migration = await readFile("drizzle/0000_closed_beta_baseline.sql", "utf8");
    await adminClient.query(migration);
  }, 30_000);

  beforeEach(async () => {
    authState.member = {
      userId: "user-a",
      email: "a@example.com",
      displayName: "User A",
      role: "student",
      emailVerified: true,
      demo: false,
    };
    await adminClient.query(`
      truncate table
        audit_logs, notification_outbox, certificates, enrollment_completions,
        submissions, assignments, lesson_progress, session_attendance,
        video_access_grants, course_materials, live_sessions, enrollments,
        seat_reservations, course_invites, cohort_status_history, cohorts,
        course_instructors, instructors, course_fields, course_tools, courses, profiles
      restart identity cascade
    `);
    await adminClient.query(`
      insert into profiles (user_id, email, display_name, role, email_verified_at)
      values
        ('admin', 'admin@example.com', 'Admin', 'admin', now()),
        ('user-a', 'a@example.com', 'User A', 'student', now()),
        ('user-b', 'b@example.com', 'User B', 'student', now());
      insert into courses (
        id, slug, title, summary, level, status,
        duration_minutes, default_minimum_enrollment, default_maximum_enrollment
      ) values (
        '${COURSE_ID}', 'integration-course', 'Integration Course', 'Integration test',
        'beginner', 'published', 60, 1, 2
      );
    `);
  });

  afterAll(async () => {
    const { closeDbConnection } = await import("@/db");
    await closeDbConnection();
    await adminClient?.end();
    delete process.env.DATABASE_URL;
  });

  it("rejects an invited reservation after the registration deadline", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "collecting",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2026-01-02T00:00:00Z",
      startsAt: "2026-01-10T00:00:00Z",
      minimum: 1,
      maximum: 2,
    });
    await insertInvite(adminClient, COHORT_ID, "a@example.com");
    const { reserveInvitedSeat } = await import("@/lib/services/cohorts");

    await expect(reserveInvitedSeat(COHORT_ID)).rejects.toThrow("ปิดรับ");
  });

  it("does not convert an expired active reservation during admin confirmation", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "threshold_met",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2099-01-02T00:00:00Z",
      startsAt: "2099-01-10T00:00:00Z",
      minimum: 1,
      maximum: 2,
    });
    const inviteA = await insertInvite(adminClient, COHORT_ID, "a@example.com");
    const inviteB = await insertInvite(adminClient, COHORT_ID, "b@example.com");
    await adminClient.query(
      `insert into seat_reservations (cohort_id, invite_id, user_id, status, proposed_starts_at, expires_at)
       values ($1, $2, 'user-a', 'active', '2099-01-10', '2026-01-01'),
              ($1, $3, 'user-b', 'active', '2099-01-10', null)`,
      [COHORT_ID, inviteA, inviteB],
    );
    const { confirmCohortByAdmin } = await import("@/lib/services/cohorts");

    const result = await confirmCohortByAdmin({ cohortId: COHORT_ID });
    const enrolled = await adminClient.query("select user_id from enrollments order by user_id");
    expect(result.enrollmentsCreated).toBe(1);
    expect(enrolled.rows).toEqual([{ user_id: "user-b" }]);
  });

  it("does not convert a reservation whose proposed date no longer matches the cohort", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "threshold_met",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2099-01-02T00:00:00Z",
      startsAt: "2099-01-10T00:00:00Z",
      minimum: 1,
      maximum: 2,
    });
    const invite = await insertInvite(adminClient, COHORT_ID, "a@example.com");
    await adminClient.query(
      `insert into seat_reservations (cohort_id, invite_id, user_id, status, proposed_starts_at)
       values ($1, $2, 'user-a', 'active', '2099-01-11')`,
      [COHORT_ID, invite],
    );
    const { confirmCohortByAdmin } = await import("@/lib/services/cohorts");

    await expect(confirmCohortByAdmin({ cohortId: COHORT_ID })).rejects.toThrow("overrideReason");
    const enrolled = await adminClient.query("select count(*)::int as count from enrollments");
    expect(enrolled.rows[0].count).toBe(0);
  });

  it("opens a draft cohort explicitly and prevents changing dates after opt-in", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "draft",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2099-01-02T00:00:00Z",
      startsAt: "2099-01-10T12:00:00Z",
      minimum: 1,
      maximum: 2,
    });
    const { openCohortRegistrationByAdmin, updateCohortByAdmin } = await import("@/lib/services/admin-operations");
    await openCohortRegistrationByAdmin(COHORT_ID);
    const opened = await adminClient.query("select status from cohorts where id = $1", [COHORT_ID]);
    expect(opened.rows[0].status).toBe("collecting");

    const invite = await insertInvite(adminClient, COHORT_ID, "a@example.com");
    await adminClient.query(
      `insert into seat_reservations (cohort_id, invite_id, user_id, status, proposed_starts_at)
       values ($1, $2, 'user-a', 'active', '2099-01-10T12:00:00Z')`,
      [COHORT_ID, invite],
    );
    await expect(updateCohortByAdmin({
      cohortId: COHORT_ID,
      startsAt: "2099-01-11T19:00",
      registrationOpensAt: "2026-01-01T07:00",
      registrationDeadlineAt: "2099-01-02T07:00",
      minimumEnrollment: 1,
      maximumEnrollment: 2,
    })).rejects.toThrow("สร้างรุ่นใหม่");
  });

  it("reevaluates a fallback cohort and reaches threshold only after learner opt-in", async () => {
    await insertCohort(adminClient, {
      id: FALLBACK_ID,
      status: "collecting",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2099-01-02T00:00:00Z",
      startsAt: "2099-01-10T00:00:00Z",
      minimum: 1,
      maximum: 2,
    });
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "postponed",
      opensAt: "2025-01-01T00:00:00Z",
      deadlineAt: "2026-01-02T00:00:00Z",
      startsAt: "2026-01-10T00:00:00Z",
      minimum: 1,
      maximum: 2,
      fallbackId: FALLBACK_ID,
    });
    const invite = await insertInvite(adminClient, COHORT_ID, "a@example.com");
    await adminClient.query(
      `insert into seat_reservations (cohort_id, invite_id, user_id, status, proposed_starts_at, expires_at)
       values ($1, $2, 'user-a', 'expired', '2026-01-10', '2026-01-02')`,
      [COHORT_ID, invite],
    );
    const { acceptFallbackCohort } = await import("@/lib/services/cohorts");

    const result = await acceptFallbackCohort(COHORT_ID);
    const fallback = await adminClient.query("select status, threshold_reached_at from cohorts where id = $1", [FALLBACK_ID]);
    expect(result.status).toBe("active");
    expect(fallback.rows[0].status).toBe("threshold_met");
    expect(fallback.rows[0].threshold_reached_at).not.toBeNull();
  });

  it("reclaims a stale processing outbox row after a worker crash", async () => {
    await adminClient.query(`
      insert into notification_outbox (
        type, recipient_email, dedupe_key, payload, status, attempts, scheduled_at, locked_at
      ) values (
        'test', 'a@example.com', 'stale-test',
        '{"to":"a@example.com","subject":"Test","text":"Body"}',
        'processing', 1, now() - interval '1 hour', now() - interval '11 minutes'
      )
    `);
    const sent: string[] = [];
    const { sendPendingNotifications } = await import("@/lib/email/outbox");
    const result = await sendPendingNotifications({
      send: async (message) => {
        sent.push(message.to);
        return { providerMessageId: "integration-test-message" };
      },
    });
    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(sent).toEqual(["a@example.com"]);
  });

  it("derives automatic completion and issues one private certificate", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "completed",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2026-01-02T00:00:00Z",
      startsAt: "2026-01-10T00:00:00Z",
      minimum: 1,
      maximum: 2,
    });
    const invite = await insertInvite(adminClient, COHORT_ID, "a@example.com");
    const reservation = await adminClient.query(
      `insert into seat_reservations (cohort_id, invite_id, user_id, status, proposed_starts_at, converted_at)
       values ($1, $2, 'user-a', 'converted', '2026-01-10', now()) returning id`,
      [COHORT_ID, invite],
    );
    const enrollment = await adminClient.query(
      `insert into enrollments (user_id, cohort_id, reservation_id)
       values ('user-a', $1, $2) returning id`,
      [COHORT_ID, reservation.rows[0].id],
    );
    const enrollmentId = enrollment.rows[0].id as string;
    const lesson = await adminClient.query(
      `insert into lessons (course_id, title, kind, sort_order, required)
       values ($1, 'Required lesson', 'video', 1, true) returning id`,
      [COURSE_ID],
    );
    const liveSession = await adminClient.query(
      `insert into live_sessions (cohort_id, title, starts_at)
       values ($1, 'Live session', '2026-01-10') returning id`,
      [COHORT_ID],
    );
    const assignment = await adminClient.query(
      `insert into assignments (course_id, title, instructions, passing_score, required)
       values ($1, 'Required assignment', 'Do the work', 70, true) returning id`,
      [COURSE_ID],
    );
    const { updateLessonProgressForMember, submitAssignmentForMember } = await import("@/lib/services/learning");
    const { recordAttendanceByAdmin, reviewSubmissionByAdmin } = await import("@/lib/services/admin-operations");
    authState.member = { ...authState.member, userId: "user-b", email: "b@example.com", displayName: "User B" };
    await expect(updateLessonProgressForMember({ enrollmentId, lessonId: lesson.rows[0].id, progressPercent: 100 })).rejects.toThrow("enrollment ของคุณ");
    authState.member = { ...authState.member, userId: "user-a", email: "a@example.com", displayName: "User A" };
    await updateLessonProgressForMember({ enrollmentId, lessonId: lesson.rows[0].id, progressPercent: 100 });
    await recordAttendanceByAdmin({ enrollmentId, liveSessionId: liveSession.rows[0].id, attendancePercent: 80 });
    await submitAssignmentForMember({ enrollmentId, assignmentId: assignment.rows[0].id, submissionUrl: "https://example.com/work" });
    const submission = await adminClient.query("select id from submissions where enrollment_id = $1", [enrollmentId]);
    await reviewSubmissionByAdmin({ submissionId: submission.rows[0].id, score: 70, status: "approved" });
    const { processEnrollmentCompletions } = await import("@/lib/services/completions");

    const result = await processEnrollmentCompletions();
    const completion = await adminClient.query(
      "select status, lesson_completion_percent, attendance_percent, assignment_pass_percent from enrollment_completions where enrollment_id = $1",
      [enrollmentId],
    );
    const certificate = await adminClient.query(
      "select public_verification_enabled from certificates where enrollment_id = $1",
      [enrollmentId],
    );
    expect(result.completed).toBe(1);
    expect(completion.rows).toEqual([
      {
        status: "completed",
        lesson_completion_percent: 100,
        attendance_percent: 80,
        assignment_pass_percent: 100,
      },
    ]);
    expect(certificate.rows).toEqual([{ public_verification_enabled: false }]);
  });

  it("enforces one active reservation per learner and cohort", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "collecting",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2099-01-02T00:00:00Z",
      startsAt: "2099-01-10T00:00:00Z",
      minimum: 1,
      maximum: 2,
    });
    const invite = await insertInvite(adminClient, COHORT_ID, "a@example.com");
    await adminClient.query(
      `insert into seat_reservations (cohort_id, invite_id, user_id, status, proposed_starts_at)
       values ($1, $2, 'user-a', 'active', '2099-01-10')`,
      [COHORT_ID, invite],
    );
    await expect(
      adminClient.query(
        `insert into seat_reservations (cohort_id, invite_id, user_id, status, proposed_starts_at)
         values ($1, $2, 'user-a', 'active', '2099-01-10')`,
        [COHORT_ID, invite],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("serializes simultaneous last-seat reservations and waitlists exactly one learner", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "collecting",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2099-01-02T00:00:00Z",
      startsAt: "2099-01-10T00:00:00Z",
      minimum: 1,
      maximum: 1,
    });
    await insertInvite(adminClient, COHORT_ID, "a@example.com");
    await insertInvite(adminClient, COHORT_ID, "b@example.com");
    const { reserveInvitedSeatForMember } = await import("@/lib/services/cohorts");

    const results = await Promise.all([
      reserveInvitedSeatForMember(COHORT_ID, { userId: "user-a", email: "a@example.com", emailVerified: true }),
      reserveInvitedSeatForMember(COHORT_ID, { userId: "user-b", email: "b@example.com", emailVerified: true }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["active", "waitlisted"]);
    const counts = await adminClient.query(
      "select status, count(*)::int as count from seat_reservations group by status order by status",
    );
    expect(counts.rows).toEqual([
      { status: "active", count: 1 },
      { status: "waitlisted", count: 1 },
    ]);
  });

  it("processes a passed deadline idempotently", async () => {
    await insertCohort(adminClient, {
      id: COHORT_ID,
      status: "collecting",
      opensAt: "2026-01-01T00:00:00Z",
      deadlineAt: "2026-01-02T00:00:00Z",
      startsAt: "2026-01-10T00:00:00Z",
      minimum: 2,
      maximum: 2,
    });
    const { processCohortDeadlines } = await import("@/lib/services/cohorts");

    expect(await processCohortDeadlines(new Date("2026-01-02T00:00:00Z"))).toEqual({ scanned: 1, postponed: 1 });
    expect(await processCohortDeadlines(new Date("2026-01-02T00:00:00Z"))).toEqual({ scanned: 0, postponed: 0 });
    const history = await adminClient.query(
      "select count(*)::int as count from cohort_status_history where cohort_id = $1 and to_status = 'postponed'",
      [COHORT_ID],
    );
    expect(history.rows[0].count).toBe(1);
  });
});

async function insertCohort(
  client: Client,
  input: {
    id: string;
    status: string;
    opensAt: string;
    deadlineAt: string;
    startsAt: string;
    minimum: number;
    maximum: number;
    fallbackId?: string;
  },
) {
  await client.query(
    `insert into cohorts (
      id, course_id, title, status, starts_at, minimum_enrollment, maximum_enrollment,
      registration_opens_at, registration_deadline_at, fallback_cohort_id
    ) values ($1, $2, $3, $4::cohort_status, $5, $6, $7, $8, $9, $10)`,
    [input.id, COURSE_ID, `Cohort ${input.id.slice(-4)}`, input.status, input.startsAt, input.minimum, input.maximum, input.opensAt, input.deadlineAt, input.fallbackId ?? null],
  );
}

async function insertInvite(client: Client, cohortId: string, email: string) {
  const result = await client.query(
    `insert into course_invites (cohort_id, email, status, invited_by_user_id, expires_at)
     values ($1, $2, 'accepted', 'admin', '2099-01-01') returning id`,
    [cohortId, email],
  );
  return result.rows[0].id as string;
}
