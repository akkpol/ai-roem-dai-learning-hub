CREATE TABLE "identity_account_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"confirmation_token_hash" text,
	"confirmation_expires_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_deletion_requests_state_check" CHECK ("identity_account_deletion_requests"."state" in ('requested','confirmed','scheduled','cancelled','completed','expired')),
	CONSTRAINT "identity_deletion_requests_timeline_check" CHECK (("identity_account_deletion_requests"."state" = 'requested' and "identity_account_deletion_requests"."confirmation_token_hash" is not null and "identity_account_deletion_requests"."confirmation_expires_at" is not null) or ("identity_account_deletion_requests"."state" = 'scheduled' and "identity_account_deletion_requests"."confirmed_at" is not null and "identity_account_deletion_requests"."scheduled_for" is not null and "identity_account_deletion_requests"."confirmation_token_hash" is null) or ("identity_account_deletion_requests"."state" = 'cancelled' and "identity_account_deletion_requests"."cancelled_at" is not null) or ("identity_account_deletion_requests"."state" = 'completed' and "identity_account_deletion_requests"."completed_at" is not null) or "identity_account_deletion_requests"."state" in ('confirmed','expired'))
);
--> statement-breakpoint
CREATE TABLE "identity_two_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "identity_two_factors_failed_count_check" CHECK ("identity_two_factors"."failed_verification_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "identity_accounts" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_accounts" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ALTER COLUMN "encrypted_payload" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_accounts" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_accounts" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity_account_deletion_requests" ADD CONSTRAINT "identity_account_deletion_requests_account_id_identity_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_two_factors" ADD CONSTRAINT "identity_two_factors_user_id_identity_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_deletion_requests_account_idx" ON "identity_account_deletion_requests" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "identity_deletion_requests_due_idx" ON "identity_account_deletion_requests" USING btree ("state","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_deletion_requests_active_unique" ON "identity_account_deletion_requests" USING btree ("account_id") WHERE "identity_account_deletion_requests"."state" in ('requested','confirmed','scheduled');--> statement-breakpoint
CREATE UNIQUE INDEX "identity_two_factors_user_id_unique" ON "identity_two_factors" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "identity_accounts" ADD CONSTRAINT "identity_accounts_closed_pii_check" CHECK (("identity_accounts"."status" = 'closed' and "identity_accounts"."email" is null and "identity_accounts"."name" is null and "identity_accounts"."closed_at" is not null) or ("identity_accounts"."status" <> 'closed' and "identity_accounts"."email" is not null and "identity_accounts"."name" is not null and "identity_accounts"."closed_at" is null));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE identity_profiles TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE identity_two_factors TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE identity_account_deletion_requests TO learning_hub_app;
--> statement-breakpoint
DO $learning_hub_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learning_hub_identity_maintenance') THEN
    CREATE ROLE learning_hub_identity_maintenance NOLOGIN;
  END IF;
END
$learning_hub_role$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO learning_hub_identity_maintenance;
--> statement-breakpoint
GRANT SELECT, UPDATE, DELETE ON TABLE
  identity_accounts,
  identity_auth_factors,
  identity_sessions,
  identity_verifications,
  identity_rate_limits,
  identity_two_factors,
  identity_profiles,
  identity_policy_acceptances,
  identity_audit_events,
  identity_email_outbox,
  identity_account_deletion_requests
TO learning_hub_identity_maintenance;
--> statement-breakpoint
GRANT INSERT ON TABLE identity_audit_events TO learning_hub_identity_maintenance;
--> statement-breakpoint
GRANT INSERT (id, event_type, aggregate_type, aggregate_id, payload, occurred_at, available_at)
ON TABLE platform_event_outbox TO learning_hub_identity_maintenance;
