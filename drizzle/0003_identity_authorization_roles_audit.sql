CREATE TABLE "identity_global_role_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_by_account_id" uuid,
	"revoked_by_account_id" uuid,
	"reason_code" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "identity_global_role_grants_role_check" CHECK ("identity_global_role_grants"."role" in ('reviewer','support_operator','finance_operator','platform_admin')),
	CONSTRAINT "identity_global_role_grants_timeline_check" CHECK ("identity_global_role_grants"."expires_at" is null or "identity_global_role_grants"."expires_at" > "identity_global_role_grants"."starts_at"),
	CONSTRAINT "identity_global_role_grants_revocation_check" CHECK (("identity_global_role_grants"."revoked_at" is null and "identity_global_role_grants"."revoked_by_account_id" is null) or ("identity_global_role_grants"."revoked_at" is not null and "identity_global_role_grants"."revoked_by_account_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD COLUMN "actor_type" text DEFAULT 'account' NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD COLUMN "correlation_id" text;--> statement-breakpoint
UPDATE "identity_audit_events"
SET "actor_account_id" = "account_id"
WHERE "actor_type" = 'account' AND "actor_account_id" IS NULL;--> statement-breakpoint
ALTER TABLE "identity_sessions" ADD COLUMN "mfa_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity_global_role_grants" ADD CONSTRAINT "identity_global_role_grants_account_id_identity_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_global_role_grants" ADD CONSTRAINT "identity_global_role_grants_granted_by_account_id_identity_accounts_id_fk" FOREIGN KEY ("granted_by_account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_global_role_grants" ADD CONSTRAINT "identity_global_role_grants_revoked_by_account_id_identity_accounts_id_fk" FOREIGN KEY ("revoked_by_account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_global_role_grants_account_idx" ON "identity_global_role_grants" USING btree ("account_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_global_role_grants_unrevoked_unique" ON "identity_global_role_grants" USING btree ("account_id","role") WHERE "identity_global_role_grants"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD CONSTRAINT "identity_audit_events_actor_account_id_identity_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."identity_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_audit_actor_time_idx" ON "identity_audit_events" USING btree ("actor_account_id","occurred_at");--> statement-breakpoint
ALTER TABLE "identity_audit_events" ADD CONSTRAINT "identity_audit_actor_check" CHECK (("identity_audit_events"."actor_type" = 'account' and "identity_audit_events"."actor_account_id" is not null) or ("identity_audit_events"."actor_type" in ('system:bootstrap','system:break-glass','system:maintenance') and "identity_audit_events"."actor_account_id" is null));--> statement-breakpoint
GRANT SELECT ON TABLE identity_global_role_grants TO learning_hub_app;--> statement-breakpoint
GRANT INSERT (
  account_id,
  role,
  granted_by_account_id,
  reason_code,
  starts_at,
  expires_at,
  granted_at
) ON TABLE identity_global_role_grants TO learning_hub_app;--> statement-breakpoint
GRANT UPDATE (revoked_by_account_id, revoked_at)
ON TABLE identity_global_role_grants TO learning_hub_app;--> statement-breakpoint
REVOKE INSERT ON TABLE identity_audit_events FROM learning_hub_app;--> statement-breakpoint
GRANT INSERT (
  account_id,
  actor_type,
  actor_account_id,
  action,
  reason_code,
  correlation_id,
  payload,
  occurred_at
) ON TABLE identity_audit_events TO learning_hub_app;--> statement-breakpoint
GRANT SELECT, UPDATE, DELETE ON TABLE identity_global_role_grants
TO learning_hub_identity_maintenance;
