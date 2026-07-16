CREATE TABLE "identity_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"age_attested_at" timestamp with time zone NOT NULL,
	CONSTRAINT "identity_accounts_email_lowercase" CHECK ("identity_accounts"."email" = lower("identity_accounts"."email")),
	CONSTRAINT "identity_accounts_status_check" CHECK ("identity_accounts"."status" in ('pending_verification','active','suspended','deletion_scheduled','closed'))
);
--> statement-breakpoint
CREATE TABLE "identity_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_auth_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"template" text NOT NULL,
	"recipient_hash" text NOT NULL,
	"encrypted_payload" text NOT NULL,
	"key_version" text NOT NULL,
	"idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_email_outbox_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "identity_email_outbox_state_check" CHECK ("identity_email_outbox"."state" in ('pending','sending','sent','retry_wait','dead_letter','expired')),
	CONSTRAINT "identity_email_outbox_attempt_count_check" CHECK ("identity_email_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "identity_policy_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"policy_type" text NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "identity_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"locale" text DEFAULT 'th-TH' NOT NULL,
	"time_zone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "identity_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "identity_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "identity_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD CONSTRAINT "identity_audit_events_account_id_identity_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_auth_factors" ADD CONSTRAINT "identity_auth_factors_user_id_identity_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD CONSTRAINT "identity_email_outbox_account_id_identity_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_policy_acceptances" ADD CONSTRAINT "identity_policy_acceptances_account_id_identity_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_account_id_identity_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_sessions" ADD CONSTRAINT "identity_sessions_user_id_identity_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."identity_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identity_accounts_email_unique" ON "identity_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "identity_audit_account_time_idx" ON "identity_audit_events" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "identity_auth_factors_user_id_idx" ON "identity_auth_factors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_auth_factors_provider_account_unique" ON "identity_auth_factors" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "identity_email_outbox_dispatch_idx" ON "identity_email_outbox" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_policy_acceptances_exact_unique" ON "identity_policy_acceptances" USING btree ("account_id","policy_type","policy_version");--> statement-breakpoint
CREATE INDEX "identity_sessions_user_id_idx" ON "identity_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "identity_verifications_identifier_idx" ON "identity_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "identity_verifications_value_idx" ON "identity_verifications" USING btree ("value");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE identity_accounts TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE identity_auth_factors TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE identity_sessions TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE identity_verifications TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE identity_rate_limits TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE identity_profiles TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE identity_policy_acceptances TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE identity_audit_events TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE identity_email_outbox TO learning_hub_app;
