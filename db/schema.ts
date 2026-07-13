import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["student", "instructor", "admin"]);
export const courseLevel = pgEnum("course_level", ["beginner", "applied", "expert"]);
export const courseStatus = pgEnum("course_status", ["draft", "published", "archived"]);
export const completionPolicy = pgEnum("completion_policy", ["automatic", "admin_approval"]);
export const cohortStatus = pgEnum("cohort_status", [
  "draft",
  "collecting",
  "threshold_met",
  "confirmed",
  "in_progress",
  "completed",
  "postponed",
  "cancelled",
]);
export const inviteStatus = pgEnum("invite_status", ["pending", "accepted", "revoked", "expired"]);
export const reservationStatus = pgEnum("reservation_status", [
  "active",
  "waitlisted",
  "withdrawn",
  "expired",
  "moved",
  "converted",
]);
export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "completed",
  "withdrawn",
  "cancelled",
]);
export const lessonKind = pgEnum("lesson_kind", ["live", "video", "reading", "workshop"]);
export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "rejected",
]);
export const materialKind = pgEnum("material_kind", ["document", "worksheet", "link"]);
export const outboxStatus = pgEnum("outbox_status", ["pending", "processing", "sent", "failed"]);
export const completionStatus = pgEnum("completion_status", [
  "in_progress",
  "qualified",
  "pending_approval",
  "completed",
]);

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    role: memberRole("role").notNull().default("student"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("profiles_email_unique").on(sql`lower(${table.email})`)],
);

export const instructors = pgTable("instructors", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileUserId: text("profile_user_id").references(() => profiles.userId, { onDelete: "set null" }),
  name: text("name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    level: courseLevel("level").notNull(),
    status: courseStatus("status").notNull().default("draft"),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    certificateEnabled: boolean("certificate_enabled").notNull().default(true),
    completionPolicy: completionPolicy("completion_policy").notNull().default("automatic"),
    defaultMinimumEnrollment: integer("default_minimum_enrollment").notNull().default(8),
    defaultMaximumEnrollment: integer("default_maximum_enrollment").notNull().default(20),
    coverUrl: text("cover_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("courses_slug_unique").on(table.slug),
    index("courses_status_level_idx").on(table.status, table.level),
    check("courses_default_minimum_positive", sql`${table.defaultMinimumEnrollment} > 0`),
    check(
      "courses_default_capacity_valid",
      sql`${table.defaultMaximumEnrollment} >= ${table.defaultMinimumEnrollment} and ${table.defaultMaximumEnrollment} <= 50`,
    ),
  ],
);

export const courseTools = pgTable(
  "course_tools",
  {
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.tool] })],
);

export const courseFields = pgTable(
  "course_fields",
  {
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.field] })],
);

export const courseInstructors = pgTable(
  "course_instructors",
  {
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id").notNull().references(() => instructors.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.instructorId] })],
);

export const cohorts = pgTable(
  "cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: cohortStatus("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    minimumEnrollment: integer("minimum_enrollment").notNull(),
    maximumEnrollment: integer("maximum_enrollment").notNull(),
    registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }).notNull(),
    registrationDeadlineAt: timestamp("registration_deadline_at", { withTimezone: true }).notNull(),
    thresholdReachedAt: timestamp("threshold_reached_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    postponedAt: timestamp("postponed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    fallbackCohortId: uuid("fallback_cohort_id").references((): AnyPgColumn => cohorts.id, {
      onDelete: "set null",
    }),
    overrideReason: text("override_reason"),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("cohorts_course_starts_idx").on(table.courseId, table.startsAt),
    index("cohorts_status_deadline_idx").on(table.status, table.registrationDeadlineAt),
    check("cohorts_minimum_positive", sql`${table.minimumEnrollment} > 0`),
    check(
      "cohorts_capacity_valid",
      sql`${table.maximumEnrollment} >= ${table.minimumEnrollment} and ${table.maximumEnrollment} <= 50`,
    ),
    check("cohorts_deadline_before_start", sql`${table.registrationDeadlineAt} < ${table.startsAt}`),
    check(
      "cohorts_registration_window_valid",
      sql`${table.registrationOpensAt} <= ${table.registrationDeadlineAt}`,
    ),
  ],
);

export const cohortStatusHistory = pgTable(
  "cohort_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    fromStatus: cohortStatus("from_status"),
    toStatus: cohortStatus("to_status").notNull(),
    actorUserId: text("actor_user_id").references(() => profiles.userId, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cohort_status_history_cohort_idx").on(table.cohortId, table.createdAt)],
);

export const courseInvites = pgTable(
  "course_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: inviteStatus("status").notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id").notNull().references(() => profiles.userId),
    acceptedByUserId: text("accepted_by_user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("course_invites_cohort_email_unique").on(table.cohortId, sql`lower(${table.email})`),
    index("course_invites_email_status_idx").on(sql`lower(${table.email})`, table.status),
  ],
);

export const seatReservations = pgTable(
  "seat_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    inviteId: uuid("invite_id").notNull().references(() => courseInvites.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    status: reservationStatus("status").notNull().default("active"),
    proposedStartsAt: timestamp("proposed_starts_at", { withTimezone: true }).notNull(),
    fallbackReservationId: uuid("fallback_reservation_id").references(
      (): AnyPgColumn => seatReservations.id,
      { onDelete: "set null" },
    ),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("seat_reservations_active_user_cohort_unique")
      .on(table.userId, table.cohortId)
      .where(sql`${table.status} = 'active'`),
    index("seat_reservations_cohort_status_idx").on(table.cohortId, table.status, table.reservedAt),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: lessonKind("kind").notNull(),
    sortOrder: integer("sort_order").notNull(),
    required: boolean("required").notNull().default(true),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    recordingUrl: text("recording_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lessons_course_sort_unique").on(table.courseId, table.sortOrder),
    check("lessons_duration_nonnegative", sql`${table.durationMinutes} >= 0`),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull().references(() => seatReservations.id, {
      onDelete: "restrict",
    }),
    status: enrollmentStatus("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("enrollments_user_cohort_unique").on(table.userId, table.cohortId),
    uniqueIndex("enrollments_reservation_unique").on(table.reservationId),
    index("enrollments_user_status_idx").on(table.userId, table.status),
  ],
);

export const liveSessions = pgTable(
  "live_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    meetingProvider: text("meeting_provider"),
    meetingUrl: text("meeting_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("live_sessions_cohort_start_idx").on(table.cohortId, table.startsAt)],
);

export const courseMaterials = pgTable(
  "course_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: materialKind("kind").notNull(),
    blobPathname: text("blob_pathname"),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("course_materials_course_lesson_idx").on(table.courseId, table.lessonId),
    check(
      "course_materials_has_source",
      sql`${table.blobPathname} is not null or ${table.externalUrl} is not null`,
    ),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.enrollmentId, table.lessonId] })],
);

export const sessionAttendance = pgTable(
  "session_attendance",
  {
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    liveSessionId: uuid("live_session_id").notNull().references(() => liveSessions.id, {
      onDelete: "cascade",
    }),
    attendancePercent: integer("attendance_percent").notNull().default(0),
    recordedByUserId: text("recorded_by_user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.liveSessionId] }),
    check(
      "session_attendance_percent_range",
      sql`${table.attendancePercent} between 0 and 100`,
    ),
  ],
);

export const videoAccessGrants = pgTable(
  "video_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    youtubeUrl: text("youtube_url").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("video_access_grants_enrollment_lesson_unique").on(table.enrollmentId, table.lessonId)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    progressPercent: integer("progress_percent").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.lessonId] }),
    check("lesson_progress_percent_range", sql`${table.progressPercent} between 0 and 100`),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    passingScore: integer("passing_score").notNull().default(70),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("assignments_passing_score_range", sql`${table.passingScore} between 0 and 100`)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id").notNull().references(() => assignments.id, {
      onDelete: "cascade",
    }),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    status: submissionStatus("status").notNull().default("draft"),
    submissionUrl: text("submission_url"),
    score: integer("score"),
    feedback: text("feedback"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("submissions_assignment_enrollment_unique").on(table.assignmentId, table.enrollmentId),
    check("submissions_score_range", sql`${table.score} is null or ${table.score} between 0 and 100`),
  ],
);

export const enrollmentCompletions = pgTable(
  "enrollment_completions",
  {
    enrollmentId: uuid("enrollment_id").primaryKey().references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    status: completionStatus("status").notNull().default("in_progress"),
    lessonCompletionPercent: integer("lesson_completion_percent").notNull().default(0),
    attendancePercent: integer("attendance_percent").notNull().default(0),
    assignmentPassPercent: integer("assignment_pass_percent").notNull().default(0),
    approvedByUserId: text("approved_by_user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "enrollment_completion_percent_ranges",
      sql`${table.lessonCompletionPercent} between 0 and 100 and ${table.attendancePercent} between 0 and 100 and ${table.assignmentPassPercent} between 0 and 100`,
    ),
  ],
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    certificateCode: text("certificate_code").notNull(),
    shareSlug: text("share_slug").notNull(),
    publicVerificationEnabled: boolean("public_verification_enabled").notNull().default(false),
    learnerNameSnapshot: text("learner_name_snapshot").notNull(),
    courseTitleSnapshot: text("course_title_snapshot").notNull(),
    instructorNameSnapshot: text("instructor_name_snapshot").notNull(),
    completedAtSnapshot: timestamp("completed_at_snapshot", { withTimezone: true }).notNull(),
    templateVersion: text("template_version").notNull(),
    pdfBlobPathname: text("pdf_blob_pathname"),
    reissuedFromCertificateId: uuid("reissued_from_certificate_id").references(
      (): AnyPgColumn => certificates.id,
      { onDelete: "set null" },
    ),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
  },
  (table) => [
    uniqueIndex("certificates_active_enrollment_unique")
      .on(table.enrollmentId)
      .where(sql`${table.revokedAt} is null`),
    uniqueIndex("certificates_code_unique").on(table.certificateCode),
    uniqueIndex("certificates_share_slug_unique").on(table.shareSlug),
  ],
);

export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: outboxStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_outbox_dedupe_unique").on(table.dedupeKey),
    index("notification_outbox_delivery_idx").on(table.status, table.scheduledAt),
    check("notification_outbox_attempts_nonnegative", sql`${table.attempts} >= 0`),
  ],
);

export const productEvents = pgTable(
  "product_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: text("event_name").notNull(),
    actorUserId: text("actor_user_id").references(() => profiles.userId, { onDelete: "set null" }),
    anonymousId: text("anonymous_id"),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("product_events_name_time_idx").on(table.eventName, table.occurredAt)],
);

export const policyAcceptances = pgTable(
  "policy_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    policyKey: text("policy_key").notNull(),
    policyVersion: text("policy_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash"),
  },
  (table) => [
    uniqueIndex("policy_acceptances_user_policy_version_unique").on(
      table.userId,
      table.policyKey,
      table.policyVersion,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => profiles.userId, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_entity_idx").on(table.entityType, table.entityId, table.createdAt)],
);
