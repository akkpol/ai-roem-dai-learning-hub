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
export const courseRevisionStatus = pgEnum("course_revision_status", [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "retired",
]);
export const completionPolicy = pgEnum("completion_policy", ["automatic", "admin_approval"]);
export const cohortStatus = pgEnum("cohort_status", [
  "draft",
  "collecting",
  "threshold_met",
  "payment_collecting",
  "confirmed",
  "in_progress",
  "completed",
  "postponed",
  "cancelled",
]);
export const cohortAdmissionMode = pgEnum("cohort_admission_mode", ["public", "invite_only"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "expired",
  "payment_failed",
  "refund_pending",
  "refunded",
]);
export const checkoutSessionStatus = pgEnum("checkout_session_status", [
  "open",
  "complete",
  "expired",
]);
export const refundStatus = pgEnum("refund_status", [
  "requested",
  "approved",
  "processing",
  "succeeded",
  "failed",
  "rejected",
]);
export const refundReason = pgEnum("refund_reason", [
  "learner_request",
  "platform_cancellation",
  "late_payment",
]);
export const webhookEventStatus = pgEnum("webhook_event_status", [
  "received",
  "processed",
  "failed",
  "ignored",
]);
export const communityThreadStatus = pgEnum("community_thread_status", [
  "open",
  "resolved",
  "locked",
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

export const memberRoles = pgTable(
  "member_roles",
  {
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    grantedByUserId: text("granted_by_user_id").references((): AnyPgColumn => profiles.userId, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("member_roles_role_idx").on(table.role, table.userId),
  ],
);

export const instructors = pgTable(
  "instructors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileUserId: text("profile_user_id").references(() => profiles.userId, { onDelete: "set null" }),
    name: text("name").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("instructors_profile_user_unique").on(table.profileUserId)],
);

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

export const courseRevisions = pgTable(
  "course_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    status: courseRevisionStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    coverUrl: text("cover_url"),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    certificateEnabled: boolean("certificate_enabled").notNull().default(true),
    completionPolicy: completionPolicy("completion_policy").notNull().default("automatic"),
    createdByUserId: text("created_by_user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("course_revisions_course_number_unique").on(
      table.courseId,
      table.revisionNumber,
    ),
    index("course_revisions_review_queue_idx").on(table.status, table.submittedAt),
    check("course_revisions_number_positive", sql`${table.revisionNumber} > 0`),
    check("course_revisions_version_positive", sql`${table.version} > 0`),
    check("course_revisions_duration_nonnegative", sql`${table.durationMinutes} >= 0`),
  ],
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    revisionId: uuid("revision_id").notNull().references(() => courseRevisions.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("course_modules_revision_sort_unique").on(table.revisionId, table.sortOrder),
    check("course_modules_sort_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const courseAuthors = pgTable(
  "course_authors",
  {
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id").references((): AnyPgColumn => profiles.userId, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.courseId, table.userId] }),
    index("course_authors_user_idx").on(table.userId, table.courseId),
  ],
);

export const cohorts = pgTable(
  "cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    courseRevisionId: uuid("course_revision_id").references(() => courseRevisions.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    status: cohortStatus("status").notNull().default("draft"),
    admissionMode: cohortAdmissionMode("admission_mode").notNull().default("invite_only"),
    priceAmount: integer("price_amount").notNull().default(0),
    currency: text("currency").notNull().default("THB"),
    paymentWindowHours: integer("payment_window_hours").notNull().default(48),
    paymentOpenedAt: timestamp("payment_opened_at", { withTimezone: true }),
    paymentDeadlineAt: timestamp("payment_deadline_at", { withTimezone: true }),
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
    check("cohorts_price_nonnegative", sql`${table.priceAmount} >= 0`),
    check("cohorts_currency_thb", sql`upper(${table.currency}) = 'THB'`),
    check("cohorts_payment_window_48_hours", sql`${table.paymentWindowHours} = 48`),
  ],
);

export const cohortInstructors = pgTable(
  "cohort_instructors",
  {
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id").references((): AnyPgColumn => profiles.userId, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.cohortId, table.userId] }),
    index("cohort_instructors_user_idx").on(table.userId, table.cohortId),
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
    inviteId: uuid("invite_id").references(() => courseInvites.id, { onDelete: "restrict" }),
    admissionModeSnapshot: cohortAdmissionMode("admission_mode_snapshot")
      .notNull()
      .default("invite_only"),
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
    check(
      "seat_reservations_invite_only_requires_invite",
      sql`${table.admissionModeSnapshot} <> 'invite_only' or ${table.inviteId} is not null`,
    ),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").references(() => courseRevisions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => courseModules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: lessonKind("kind").notNull(),
    sortOrder: integer("sort_order").notNull(),
    required: boolean("required").notNull().default(true),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    recordingUrl: text("recording_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lessons_course_sort_unique")
      .on(table.courseId, table.sortOrder)
      .where(sql`${table.revisionId} is null`),
    uniqueIndex("lessons_revision_sort_unique")
      .on(table.revisionId, table.sortOrder)
      .where(sql`${table.revisionId} is not null`),
    check("lessons_duration_nonnegative", sql`${table.durationMinutes} >= 0`),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    courseRevisionId: uuid("course_revision_id").references(() => courseRevisions.id, {
      onDelete: "restrict",
    }),
    reservationId: uuid("reservation_id").notNull().references(() => seatReservations.id, {
      onDelete: "restrict",
    }),
    orderId: uuid("order_id").references((): AnyPgColumn => orders.id, {
      onDelete: "restrict",
    }),
    status: enrollmentStatus("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("enrollments_user_cohort_unique").on(table.userId, table.cohortId),
    uniqueIndex("enrollments_reservation_unique").on(table.reservationId),
    uniqueIndex("enrollments_order_unique").on(table.orderId),
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
    revisionId: uuid("revision_id").references(() => courseRevisions.id, { onDelete: "cascade" }),
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
    revisionId: uuid("revision_id").references(() => courseRevisions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => courseModules.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
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

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationId: uuid("reservation_id").notNull().references(() => seatReservations.id, {
      onDelete: "restrict",
    }),
    userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "restrict" }),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("THB"),
    policySnapshot: jsonb("policy_snapshot").$type<{
      refundVersion: string;
      refundableUntil: string | null;
      priceLabel: string;
    }>().notNull(),
    paymentDeadlineAt: timestamp("payment_deadline_at", { withTimezone: true }).notNull(),
    providerPaymentIntentId: text("provider_payment_intent_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_reservation_unique").on(table.reservationId),
    uniqueIndex("orders_provider_payment_intent_unique").on(table.providerPaymentIntentId),
    index("orders_status_deadline_idx").on(table.status, table.paymentDeadlineAt),
    check("orders_amount_positive", sql`${table.amount} > 0`),
    check("orders_currency_thb", sql`upper(${table.currency}) = 'THB'`),
  ],
);

export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    providerSessionId: text("provider_session_id").notNull(),
    status: checkoutSessionStatus("status").notNull().default("open"),
    checkoutUrl: text("checkout_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("checkout_sessions_provider_unique").on(table.providerSessionId),
    index("checkout_sessions_order_status_idx").on(table.orderId, table.status),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("THB"),
    reason: refundReason("reason").notNull(),
    status: refundStatus("status").notNull().default("requested"),
    requestedByUserId: text("requested_by_user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    approvedByUserId: text("approved_by_user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    providerRefundId: text("provider_refund_id"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("refunds_order_reason_unique").on(table.orderId, table.reason),
    uniqueIndex("refunds_provider_unique").on(table.providerRefundId),
    index("refunds_status_created_idx").on(table.status, table.createdAt),
    check("refunds_amount_positive", sql`${table.amount} > 0`),
    check("refunds_currency_thb", sql`upper(${table.currency}) = 'THB'`),
  ],
);

export const providerWebhookEvents = pgTable(
  "provider_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("stripe"),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: webhookEventStatus("status").notNull().default("received"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    errorMessage: text("error_message"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("provider_webhook_events_provider_event_unique").on(
      table.provider,
      table.providerEventId,
    ),
    index("provider_webhook_events_status_idx").on(table.status, table.receivedAt),
  ],
);

export const cohortAnnouncements = pgTable(
  "cohort_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").notNull().references(() => profiles.userId, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cohort_announcements_cohort_idx").on(table.cohortId, table.pinned, table.publishedAt)],
);

export const cohortThreads = pgTable(
  "cohort_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").notNull().references(() => profiles.userId, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: communityThreadStatus("status").notNull().default("open"),
    pinned: boolean("pinned").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("cohort_threads_cohort_status_idx").on(table.cohortId, table.status, table.pinned, table.updatedAt),
  ],
);

export const cohortThreadReplies = pgTable(
  "cohort_thread_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull().references(() => cohortThreads.id, {
      onDelete: "cascade",
    }),
    authorUserId: text("author_user_id").notNull().references(() => profiles.userId, {
      onDelete: "restrict",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cohort_thread_replies_thread_idx").on(table.threadId, table.createdAt)],
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
