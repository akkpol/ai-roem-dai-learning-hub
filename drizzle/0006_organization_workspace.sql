CREATE TABLE "organization_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "organization_memberships_role_check" CHECK ("organization_memberships"."role" in ('owner','manager','member')),
	CONSTRAINT "organization_memberships_status_check" CHECK ("organization_memberships"."status" in ('active','removed')),
	CONSTRAINT "organization_memberships_removal_check" CHECK (("organization_memberships"."status" = 'active' and "organization_memberships"."removed_at" is null) or ("organization_memberships"."status" = 'removed' and "organization_memberships"."removed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"contact_email" text NOT NULL,
	"locale" text NOT NULL,
	"time_zone" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_check" CHECK ("organizations"."slug" ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
	CONSTRAINT "organizations_display_name_length_check" CHECK (char_length("organizations"."display_name") between 2 and 160),
	CONSTRAINT "organizations_description_length_check" CHECK ("organizations"."description" is null or char_length("organizations"."description") <= 1000),
	CONSTRAINT "organizations_contact_email_lowercase" CHECK ("organizations"."contact_email" = lower("organizations"."contact_email")),
	CONSTRAINT "organizations_locale_check" CHECK ("organizations"."locale" in ('th-TH','en-US')),
	CONSTRAINT "organizations_time_zone_check" CHECK (char_length("organizations"."time_zone") between 1 and 128),
	CONSTRAINT "organizations_status_check" CHECK ("organizations"."status" in ('active','suspended')),
	CONSTRAINT "organizations_version_check" CHECK ("organizations"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "organization_audit_events" ADD CONSTRAINT "organization_audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_audit_events_organization_time_idx" ON "organization_audit_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "organization_memberships_organization_idx" ON "organization_memberships" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "organization_memberships_account_idx" ON "organization_memberships" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_active_account_unique" ON "organization_memberships" USING btree ("organization_id","account_id") WHERE "organization_memberships"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");
--> statement-breakpoint
CREATE FUNCTION organization_audit_payload_is_safe(
  p_action text,
  p_payload jsonb
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(CASE
    WHEN p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN false
    WHEN p_action = 'organization.created.v1' THEN
      p_payload - 'slug' = '{}'::jsonb
      AND p_payload->>'slug' ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'
    WHEN p_action = 'organization.identity_updated.v1' THEN
      p_payload = '{"fields":"display_name,description,locale,time_zone"}'::jsonb
    ELSE false
  END, false)
$$;
--> statement-breakpoint
ALTER TABLE organization_audit_events
ADD CONSTRAINT organization_audit_events_payload_safe_check
CHECK (organization_audit_payload_is_safe(action, payload));
--> statement-breakpoint
REVOKE ALL ON FUNCTION organization_audit_payload_is_safe(text, jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION organization_audit_payload_is_safe(text, jsonb)
TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT, INSERT (
  display_name,
  slug,
  description,
  contact_email,
  locale,
  time_zone
) ON TABLE organizations TO learning_hub_app;
--> statement-breakpoint
GRANT UPDATE (
  display_name,
  description,
  contact_email,
  locale,
  time_zone,
  version,
  updated_at
) ON TABLE organizations TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT ON TABLE organization_memberships TO learning_hub_app;
--> statement-breakpoint
GRANT INSERT (
  organization_id,
  account_id,
  role,
  status
) ON TABLE organization_memberships TO learning_hub_app;
--> statement-breakpoint
GRANT INSERT (
  organization_id,
  actor_account_id,
  action,
  payload,
  occurred_at
) ON TABLE organization_audit_events TO learning_hub_app;
