CREATE TYPE "public"."checkout_session_status" AS ENUM('open', 'complete', 'expired');--> statement-breakpoint
CREATE TYPE "public"."cohort_admission_mode" AS ENUM('public', 'invite_only');--> statement-breakpoint
CREATE TYPE "public"."community_thread_status" AS ENUM('open', 'resolved', 'locked');--> statement-breakpoint
CREATE TYPE "public"."course_revision_status" AS ENUM('draft', 'in_review', 'changes_requested', 'approved', 'retired');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'expired', 'payment_failed', 'refund_pending', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('learner_request', 'platform_cancellation', 'late_payment');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'approved', 'processing', 'succeeded', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('received', 'processed', 'failed', 'ignored');--> statement-breakpoint
ALTER TYPE "public"."cohort_status" ADD VALUE 'payment_collecting' BEFORE 'confirmed';--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider_session_id" text NOT NULL,
	"status" "checkout_session_status" DEFAULT 'open' NOT NULL,
	"checkout_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_instructors" (
	"cohort_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_instructors_cohort_id_user_id_pk" PRIMARY KEY("cohort_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "cohort_thread_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "community_thread_status" DEFAULT 'open' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_authors" (
	"course_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_authors_course_id_user_id_pk" PRIMARY KEY("course_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_modules_sort_nonnegative" CHECK ("course_modules"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "course_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"status" "course_revision_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"cover_url" text,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"certificate_enabled" boolean DEFAULT true NOT NULL,
	"completion_policy" "completion_policy" DEFAULT 'automatic' NOT NULL,
	"created_by_user_id" text,
	"submitted_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_revisions_number_positive" CHECK ("course_revisions"."revision_number" > 0),
	CONSTRAINT "course_revisions_version_positive" CHECK ("course_revisions"."version" > 0),
	CONSTRAINT "course_revisions_duration_nonnegative" CHECK ("course_revisions"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "member_roles" (
	"user_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"granted_by_user_id" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"cohort_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"payment_deadline_at" timestamp with time zone NOT NULL,
	"provider_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_amount_positive" CHECK ("orders"."amount" > 0),
	CONSTRAINT "orders_currency_thb" CHECK (upper("orders"."currency") = 'THB')
);
--> statement-breakpoint
CREATE TABLE "provider_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" "webhook_event_status" DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"requested_by_user_id" text,
	"approved_by_user_id" text,
	"provider_refund_id" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount" > 0),
	CONSTRAINT "refunds_currency_thb" CHECK (upper("refunds"."currency") = 'THB')
);
--> statement-breakpoint
DROP INDEX "lessons_course_sort_unique";--> statement-breakpoint
ALTER TABLE "seat_reservations" ALTER COLUMN "invite_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "revision_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "module_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "course_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "admission_mode" "cohort_admission_mode" DEFAULT 'invite_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "price_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "currency" text DEFAULT 'THB' NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "payment_window_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "payment_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "payment_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN "revision_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "course_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "revision_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "module_id" uuid;--> statement-breakpoint
ALTER TABLE "seat_reservations" ADD COLUMN "admission_mode_snapshot" "cohort_admission_mode" DEFAULT 'invite_only' NOT NULL;--> statement-breakpoint
-- Expansion backfill: keep profiles.role as the rollback source for one release.
INSERT INTO "member_roles" ("user_id", "role")
SELECT "user_id", "role" FROM "profiles"
ON CONFLICT ("user_id", "role") DO NOTHING;--> statement-breakpoint
INSERT INTO "member_roles" ("user_id", "role")
SELECT DISTINCT "profile_user_id", 'instructor'::"member_role"
FROM "instructors"
WHERE "profile_user_id" IS NOT NULL
ON CONFLICT ("user_id", "role") DO NOTHING;--> statement-breakpoint
-- Existing instructor assignments become author and cohort-delivery scopes.
INSERT INTO "course_authors" ("course_id", "user_id")
SELECT DISTINCT ci."course_id", i."profile_user_id"
FROM "course_instructors" ci
JOIN "instructors" i ON i."id" = ci."instructor_id"
WHERE i."profile_user_id" IS NOT NULL
ON CONFLICT ("course_id", "user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "cohort_instructors" ("cohort_id", "user_id")
SELECT DISTINCT c."id", i."profile_user_id"
FROM "cohorts" c
JOIN "course_instructors" ci ON ci."course_id" = c."course_id"
JOIN "instructors" i ON i."id" = ci."instructor_id"
WHERE i."profile_user_id" IS NOT NULL
ON CONFLICT ("cohort_id", "user_id") DO NOTHING;--> statement-breakpoint
-- Snapshot every existing course as revision 1 without changing its public identity/slug.
INSERT INTO "course_revisions" (
	"course_id", "revision_number", "status", "title", "summary", "cover_url",
	"duration_minutes", "certificate_enabled", "completion_policy", "approved_at",
	"created_at", "updated_at"
)
SELECT
	c."id", 1,
	CASE
		WHEN c."status" = 'published' THEN 'approved'::"course_revision_status"
		WHEN c."status" = 'archived' THEN 'retired'::"course_revision_status"
		ELSE 'draft'::"course_revision_status"
	END,
	c."title", c."summary", c."cover_url", c."duration_minutes",
	c."certificate_enabled", c."completion_policy",
	CASE WHEN c."status" = 'published' THEN COALESCE(c."published_at", c."updated_at") ELSE NULL END,
	c."created_at", c."updated_at"
FROM "courses" c
ON CONFLICT ("course_id", "revision_number") DO NOTHING;--> statement-breakpoint
-- Legacy flat curricula are placed in a default module, then pinned to revision 1.
INSERT INTO "course_modules" ("revision_id", "title", "summary", "sort_order")
SELECT cr."id", 'ภาพรวมหลักสูตร', 'เนื้อหาที่นำเข้าจากโครงสร้างก่อนใช้ Course Studio', 0
FROM "course_revisions" cr
WHERE cr."revision_number" = 1
ON CONFLICT ("revision_id", "sort_order") DO NOTHING;--> statement-breakpoint
UPDATE "lessons" l
SET "revision_id" = cr."id", "module_id" = cm."id"
FROM "course_revisions" cr
JOIN "course_modules" cm ON cm."revision_id" = cr."id" AND cm."sort_order" = 0
WHERE cr."course_id" = l."course_id" AND cr."revision_number" = 1 AND l."revision_id" IS NULL;--> statement-breakpoint
UPDATE "assignments" a
SET "revision_id" = cr."id", "module_id" = cm."id"
FROM "course_revisions" cr
JOIN "course_modules" cm ON cm."revision_id" = cr."id" AND cm."sort_order" = 0
WHERE cr."course_id" = a."course_id" AND cr."revision_number" = 1 AND a."revision_id" IS NULL;--> statement-breakpoint
UPDATE "course_materials" m
SET "revision_id" = cr."id"
FROM "course_revisions" cr
WHERE cr."course_id" = m."course_id" AND cr."revision_number" = 1 AND m."revision_id" IS NULL;--> statement-breakpoint
UPDATE "cohorts" c
SET "course_revision_id" = cr."id"
FROM "course_revisions" cr
WHERE cr."course_id" = c."course_id" AND cr."revision_number" = 1 AND c."course_revision_id" IS NULL;--> statement-breakpoint
UPDATE "enrollments" e
SET "course_revision_id" = c."course_revision_id"
FROM "cohorts" c
WHERE c."id" = e."cohort_id" AND e."course_revision_id" IS NULL;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_announcements" ADD CONSTRAINT "cohort_announcements_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_announcements" ADD CONSTRAINT "cohort_announcements_author_user_id_profiles_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_instructors" ADD CONSTRAINT "cohort_instructors_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_instructors" ADD CONSTRAINT "cohort_instructors_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_instructors" ADD CONSTRAINT "cohort_instructors_assigned_by_user_id_profiles_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_thread_replies" ADD CONSTRAINT "cohort_thread_replies_thread_id_cohort_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."cohort_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_thread_replies" ADD CONSTRAINT "cohort_thread_replies_author_user_id_profiles_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_threads" ADD CONSTRAINT "cohort_threads_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_threads" ADD CONSTRAINT "cohort_threads_author_user_id_profiles_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_authors" ADD CONSTRAINT "course_authors_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_authors" ADD CONSTRAINT "course_authors_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_authors" ADD CONSTRAINT "course_authors_assigned_by_user_id_profiles_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_revision_id_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."course_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_revisions" ADD CONSTRAINT "course_revisions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_revisions" ADD CONSTRAINT "course_revisions_created_by_user_id_profiles_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_revisions" ADD CONSTRAINT "course_revisions_reviewed_by_user_id_profiles_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_granted_by_user_id_profiles_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_reservation_id_seat_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."seat_reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_profiles_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_user_id_profiles_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_sessions_provider_unique" ON "checkout_sessions" USING btree ("provider_session_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_order_status_idx" ON "checkout_sessions" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "cohort_announcements_cohort_idx" ON "cohort_announcements" USING btree ("cohort_id","pinned","published_at");--> statement-breakpoint
CREATE INDEX "cohort_instructors_user_idx" ON "cohort_instructors" USING btree ("user_id","cohort_id");--> statement-breakpoint
CREATE INDEX "cohort_thread_replies_thread_idx" ON "cohort_thread_replies" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "cohort_threads_cohort_status_idx" ON "cohort_threads" USING btree ("cohort_id","status","pinned","updated_at");--> statement-breakpoint
CREATE INDEX "course_authors_user_idx" ON "course_authors" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_modules_revision_sort_unique" ON "course_modules" USING btree ("revision_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "course_revisions_course_number_unique" ON "course_revisions" USING btree ("course_id","revision_number");--> statement-breakpoint
CREATE INDEX "course_revisions_review_queue_idx" ON "course_revisions" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "member_roles_role_idx" ON "member_roles" USING btree ("role","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reservation_unique" ON "orders" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_payment_intent_unique" ON "orders" USING btree ("provider_payment_intent_id");--> statement-breakpoint
CREATE INDEX "orders_status_deadline_idx" ON "orders" USING btree ("status","payment_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_webhook_events_provider_event_unique" ON "provider_webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "provider_webhook_events_status_idx" ON "provider_webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_order_reason_unique" ON "refunds" USING btree ("order_id","reason");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_provider_unique" ON "refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "refunds_status_created_idx" ON "refunds" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_revision_id_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."course_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_course_revision_id_course_revisions_id_fk" FOREIGN KEY ("course_revision_id") REFERENCES "public"."course_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_revision_id_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."course_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_revision_id_course_revisions_id_fk" FOREIGN KEY ("course_revision_id") REFERENCES "public"."course_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_revision_id_course_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."course_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_order_unique" ON "enrollments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instructors_profile_user_unique" ON "instructors" USING btree ("profile_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_revision_sort_unique" ON "lessons" USING btree ("revision_id","sort_order") WHERE "lessons"."revision_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_course_sort_unique" ON "lessons" USING btree ("course_id","sort_order") WHERE "lessons"."revision_id" is null;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_price_nonnegative" CHECK ("cohorts"."price_amount" >= 0);--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_currency_thb" CHECK (upper("cohorts"."currency") = 'THB');--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_payment_window_48_hours" CHECK ("cohorts"."payment_window_hours" = 48);--> statement-breakpoint
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_invite_only_requires_invite" CHECK ("seat_reservations"."admission_mode_snapshot" <> 'invite_only' or "seat_reservations"."invite_id" is not null);
