CREATE TYPE "public"."cohort_status" AS ENUM('draft', 'collecting', 'threshold_met', 'confirmed', 'in_progress', 'completed', 'postponed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."completion_policy" AS ENUM('automatic', 'admin_approval');--> statement-breakpoint
CREATE TYPE "public"."completion_status" AS ENUM('in_progress', 'qualified', 'pending_approval', 'completed');--> statement-breakpoint
CREATE TYPE "public"."course_level" AS ENUM('beginner', 'applied', 'expert');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'withdrawn', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."lesson_kind" AS ENUM('live', 'video', 'reading', 'workshop');--> statement-breakpoint
CREATE TYPE "public"."material_kind" AS ENUM('document', 'worksheet', 'link');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('student', 'instructor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('active', 'waitlisted', 'withdrawn', 'expired', 'moved', 'converted');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_passing_score_range" CHECK ("assignments"."passing_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_enrollment_id_lesson_id_pk" PRIMARY KEY("enrollment_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"certificate_code" text NOT NULL,
	"share_slug" text NOT NULL,
	"public_verification_enabled" boolean DEFAULT false NOT NULL,
	"learner_name_snapshot" text NOT NULL,
	"course_title_snapshot" text NOT NULL,
	"instructor_name_snapshot" text NOT NULL,
	"completed_at_snapshot" timestamp with time zone NOT NULL,
	"template_version" text NOT NULL,
	"pdf_blob_pathname" text,
	"reissued_from_certificate_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text
);
--> statement-breakpoint
CREATE TABLE "cohort_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"from_status" "cohort_status",
	"to_status" "cohort_status" NOT NULL,
	"actor_user_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "cohort_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"minimum_enrollment" integer NOT NULL,
	"maximum_enrollment" integer NOT NULL,
	"registration_opens_at" timestamp with time zone NOT NULL,
	"registration_deadline_at" timestamp with time zone NOT NULL,
	"threshold_reached_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"postponed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"fallback_cohort_id" uuid,
	"override_reason" text,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohorts_minimum_positive" CHECK ("cohorts"."minimum_enrollment" > 0),
	CONSTRAINT "cohorts_capacity_valid" CHECK ("cohorts"."maximum_enrollment" >= "cohorts"."minimum_enrollment" and "cohorts"."maximum_enrollment" <= 50),
	CONSTRAINT "cohorts_deadline_before_start" CHECK ("cohorts"."registration_deadline_at" < "cohorts"."starts_at"),
	CONSTRAINT "cohorts_registration_window_valid" CHECK ("cohorts"."registration_opens_at" <= "cohorts"."registration_deadline_at")
);
--> statement-breakpoint
CREATE TABLE "course_fields" (
	"course_id" uuid NOT NULL,
	"field" text NOT NULL,
	CONSTRAINT "course_fields_course_id_field_pk" PRIMARY KEY("course_id","field")
);
--> statement-breakpoint
CREATE TABLE "course_instructors" (
	"course_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	CONSTRAINT "course_instructors_course_id_instructor_id_pk" PRIMARY KEY("course_id","instructor_id")
);
--> statement-breakpoint
CREATE TABLE "course_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"email" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"lesson_id" uuid,
	"title" text NOT NULL,
	"kind" "material_kind" NOT NULL,
	"blob_pathname" text,
	"external_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_materials_has_source" CHECK ("course_materials"."blob_pathname" is not null or "course_materials"."external_url" is not null)
);
--> statement-breakpoint
CREATE TABLE "course_tools" (
	"course_id" uuid NOT NULL,
	"tool" text NOT NULL,
	CONSTRAINT "course_tools_course_id_tool_pk" PRIMARY KEY("course_id","tool")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"level" "course_level" NOT NULL,
	"status" "course_status" DEFAULT 'draft' NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"certificate_enabled" boolean DEFAULT true NOT NULL,
	"completion_policy" "completion_policy" DEFAULT 'automatic' NOT NULL,
	"default_minimum_enrollment" integer DEFAULT 8 NOT NULL,
	"default_maximum_enrollment" integer DEFAULT 20 NOT NULL,
	"cover_url" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_default_minimum_positive" CHECK ("courses"."default_minimum_enrollment" > 0),
	CONSTRAINT "courses_default_capacity_valid" CHECK ("courses"."default_maximum_enrollment" >= "courses"."default_minimum_enrollment" and "courses"."default_maximum_enrollment" <= 50)
);
--> statement-breakpoint
CREATE TABLE "enrollment_completions" (
	"enrollment_id" uuid PRIMARY KEY NOT NULL,
	"status" "completion_status" DEFAULT 'in_progress' NOT NULL,
	"lesson_completion_percent" integer DEFAULT 0 NOT NULL,
	"attendance_percent" integer DEFAULT 0 NOT NULL,
	"assignment_pass_percent" integer DEFAULT 0 NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_completion_percent_ranges" CHECK ("enrollment_completions"."lesson_completion_percent" between 0 and 100 and "enrollment_completions"."attendance_percent" between 0 and 100 and "enrollment_completions"."assignment_pass_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cohort_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_user_id" text,
	"name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_progress_enrollment_id_lesson_id_pk" PRIMARY KEY("enrollment_id","lesson_id"),
	CONSTRAINT "lesson_progress_percent_range" CHECK ("lesson_progress"."progress_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "lesson_kind" NOT NULL,
	"sort_order" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"recording_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_duration_nonnegative" CHECK ("lessons"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"lesson_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"meeting_provider" text,
	"meeting_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"recipient_email" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_attempts_nonnegative" CHECK ("notification_outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "policy_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"policy_key" text NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"actor_user_id" text,
	"anonymous_id" text,
	"course_id" uuid,
	"cohort_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"role" "member_role" DEFAULT 'student' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"invite_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "reservation_status" DEFAULT 'active' NOT NULL,
	"proposed_starts_at" timestamp with time zone NOT NULL,
	"fallback_reservation_id" uuid,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_attendance" (
	"enrollment_id" uuid NOT NULL,
	"live_session_id" uuid NOT NULL,
	"attendance_percent" integer DEFAULT 0 NOT NULL,
	"recorded_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_attendance_enrollment_id_live_session_id_pk" PRIMARY KEY("enrollment_id","live_session_id"),
	CONSTRAINT "session_attendance_percent_range" CHECK ("session_attendance"."attendance_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"status" "submission_status" DEFAULT 'draft' NOT NULL,
	"submission_url" text,
	"score" integer,
	"feedback" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "submissions_score_range" CHECK ("submissions"."score" is null or "submissions"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "video_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"youtube_url" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_profiles_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_reissued_from_certificate_id_certificates_id_fk" FOREIGN KEY ("reissued_from_certificate_id") REFERENCES "public"."certificates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_status_history" ADD CONSTRAINT "cohort_status_history_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_status_history" ADD CONSTRAINT "cohort_status_history_actor_user_id_profiles_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_fallback_cohort_id_cohorts_id_fk" FOREIGN KEY ("fallback_cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_fields" ADD CONSTRAINT "course_fields_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_invites" ADD CONSTRAINT "course_invites_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_invites" ADD CONSTRAINT "course_invites_invited_by_user_id_profiles_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_invites" ADD CONSTRAINT "course_invites_accepted_by_user_id_profiles_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_tools" ADD CONSTRAINT "course_tools_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_completions" ADD CONSTRAINT "enrollment_completions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_completions" ADD CONSTRAINT "enrollment_completions_approved_by_user_id_profiles_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_reservation_id_seat_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."seat_reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_profile_user_id_profiles_user_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_actor_user_id_profiles_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_invite_id_course_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."course_invites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_fallback_reservation_id_seat_reservations_id_fk" FOREIGN KEY ("fallback_reservation_id") REFERENCES "public"."seat_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_live_session_id_live_sessions_id_fk" FOREIGN KEY ("live_session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_recorded_by_user_id_profiles_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_access_grants" ADD CONSTRAINT "video_access_grants_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_access_grants" ADD CONSTRAINT "video_access_grants_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_active_enrollment_unique" ON "certificates" USING btree ("enrollment_id") WHERE "certificates"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_code_unique" ON "certificates" USING btree ("certificate_code");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_share_slug_unique" ON "certificates" USING btree ("share_slug");--> statement-breakpoint
CREATE INDEX "cohort_status_history_cohort_idx" ON "cohort_status_history" USING btree ("cohort_id","created_at");--> statement-breakpoint
CREATE INDEX "cohorts_course_starts_idx" ON "cohorts" USING btree ("course_id","starts_at");--> statement-breakpoint
CREATE INDEX "cohorts_status_deadline_idx" ON "cohorts" USING btree ("status","registration_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "course_invites_cohort_email_unique" ON "course_invites" USING btree ("cohort_id",lower("email"));--> statement-breakpoint
CREATE INDEX "course_invites_email_status_idx" ON "course_invites" USING btree (lower("email"),"status");--> statement-breakpoint
CREATE INDEX "course_materials_course_lesson_idx" ON "course_materials" USING btree ("course_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_slug_unique" ON "courses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "courses_status_level_idx" ON "courses" USING btree ("status","level");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_cohort_unique" ON "enrollments" USING btree ("user_id","cohort_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_reservation_unique" ON "enrollments" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "enrollments_user_status_idx" ON "enrollments" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_course_sort_unique" ON "lessons" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE INDEX "live_sessions_cohort_start_idx" ON "live_sessions" USING btree ("cohort_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_dedupe_unique" ON "notification_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_delivery_idx" ON "notification_outbox" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_acceptances_user_policy_version_unique" ON "policy_acceptances" USING btree ("user_id","policy_key","policy_version");--> statement-breakpoint
CREATE INDEX "product_events_name_time_idx" ON "product_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_unique" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "seat_reservations_active_user_cohort_unique" ON "seat_reservations" USING btree ("user_id","cohort_id") WHERE "seat_reservations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "seat_reservations_cohort_status_idx" ON "seat_reservations" USING btree ("cohort_id","status","reserved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_assignment_enrollment_unique" ON "submissions" USING btree ("assignment_id","enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_access_grants_enrollment_lesson_unique" ON "video_access_grants" USING btree ("enrollment_id","lesson_id");