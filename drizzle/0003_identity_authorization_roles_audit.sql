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
CREATE FUNCTION identity_audit_payload_is_safe(
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
    WHEN p_payload = '{"retention":"anonymized"}'::jsonb THEN true
    WHEN p_action IN (
      'identity.account_suspended.v1',
      'identity.account_reactivated.v1'
    ) THEN p_payload = '{}'::jsonb
    WHEN p_action = 'identity.signup_requested.v1'
      THEN p_payload = '{"source":"email_password"}'::jsonb
    WHEN p_action = 'identity.email_verified.v1'
      THEN p_payload = '{"source":"email_link"}'::jsonb
    WHEN p_action = 'identity.password_reset_requested.v1'
      THEN p_payload IN (
        '{"source":"email_password","requestContext":"user_agent_present"}'::jsonb,
        '{"source":"email_password","requestContext":"user_agent_absent"}'::jsonb
      )
    WHEN p_action = 'identity.password_reset_completed.v1'
      THEN p_payload = '{"source":"email_password"}'::jsonb
    WHEN p_action = 'identity.profile_updated.v1'
      THEN p_payload = '{"fields":"display_name,locale,time_zone"}'::jsonb
    WHEN p_action = 'identity.session_revoked.v1'
      THEN p_payload = '{"scope":"single_device"}'::jsonb
    WHEN p_action = 'identity.sessions_revoked.v1'
      THEN p_payload = '{"scope":"all_other"}'::jsonb
    WHEN p_action = 'identity.password_changed.v1'
      THEN p_payload = '{"sessions":"other_revoked"}'::jsonb
    WHEN p_action IN (
      'identity.two_factor_enabled.v1',
      'identity.two_factor_disabled.v1'
    ) THEN
      p_payload - 'method' = '{}'::jsonb
      AND p_payload->>'method' IN ('totp', 'recovery')
    WHEN p_action = 'identity.account_deletion_requested.v1'
      THEN p_payload = '{"confirmation":"email"}'::jsonb
    WHEN p_action = 'identity.account_deletion_scheduled.v1'
      THEN p_payload = '{"coolingPeriodDays":"7"}'::jsonb
    WHEN p_action = 'identity.account_deletion_cancelled.v1'
      THEN p_payload IN (
        '{"authentication":"password"}'::jsonb,
        '{"authentication":"password_mfa"}'::jsonb
      )
    WHEN p_action = 'identity.account_closed.v1'
      THEN p_payload = '{"reasonCode":"user_requested"}'::jsonb
    WHEN p_action = 'identity.sessions_revoked_by_operator.v1'
      THEN
        p_payload - 'revokedCount' = '{}'::jsonb
        AND jsonb_typeof(p_payload->'revokedCount') = 'number'
        AND (p_payload->>'revokedCount') ~ '^[0-9]+$'
    WHEN p_action IN (
      'identity.global_role_expired.v1',
      'identity.global_role_granted.v1',
      'identity.global_role_revoked.v1'
    ) THEN
      p_payload - 'role' - 'grantId' = '{}'::jsonb
      AND p_payload->>'role' IN (
        'reviewer',
        'support_operator',
        'finance_operator',
        'platform_admin'
      )
      AND p_payload->>'grantId' ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    WHEN p_action = 'identity.admin_mfa_recovery.v1'
      THEN
        p_payload - 'incidentId' - 'environment' - 'sessionsRevoked' = '{}'::jsonb
        AND p_payload->>'incidentId' ~ '^[A-Z][A-Z0-9-]{2,63}$'
        AND p_payload->>'environment' IN (
          'development',
          'test',
          'preview',
          'production'
        )
        AND jsonb_typeof(p_payload->'sessionsRevoked') = 'number'
        AND (p_payload->>'sessionsRevoked') ~ '^[0-9]+$'
    ELSE p_payload = '{}'::jsonb
  END, false)
$$;--> statement-breakpoint
UPDATE identity_audit_events
SET payload = '{}'::jsonb
WHERE NOT identity_audit_payload_is_safe(action, payload);--> statement-breakpoint
ALTER TABLE identity_audit_events
ADD CONSTRAINT identity_audit_payload_safe_check
CHECK (identity_audit_payload_is_safe(action, payload));--> statement-breakpoint
CREATE FUNCTION identity_append_account_audit(
  p_target_account_id uuid,
  p_actor_account_id uuid,
  p_action text,
  p_reason_code text,
  p_correlation_id text,
  p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_target_account_id IS NULL OR p_actor_account_id IS NULL THEN
    RAISE EXCEPTION 'account audit attribution is required';
  END IF;
  IF p_reason_code IS NOT NULL
    AND p_reason_code !~ '^[a-z0-9][a-z0-9_.-]{2,63}$'
  THEN
    RAISE EXCEPTION 'invalid audit reason code';
  END IF;
  IF p_correlation_id IS NOT NULL
    AND (length(p_correlation_id) > 128 OR p_correlation_id !~ '^[A-Za-z0-9_.:-]+$')
  THEN
    RAISE EXCEPTION 'invalid audit correlation id';
  END IF;
  IF NOT public.identity_audit_payload_is_safe(p_action, p_payload) THEN
    RAISE EXCEPTION 'unsafe audit payload';
  END IF;
  INSERT INTO public.identity_audit_events (
    account_id,
    actor_type,
    actor_account_id,
    action,
    reason_code,
    correlation_id,
    payload,
    occurred_at
  ) VALUES (
    p_target_account_id,
    'account',
    p_actor_account_id,
    p_action,
    p_reason_code,
    p_correlation_id,
    p_payload,
    transaction_timestamp()
  );
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION identity_audit_payload_is_safe(text, jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION identity_append_account_audit(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION identity_audit_payload_is_safe(text, jsonb)
TO learning_hub_identity_maintenance;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION identity_append_account_audit(uuid, uuid, text, text, text, jsonb)
TO learning_hub_app;--> statement-breakpoint
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
GRANT SELECT, UPDATE, DELETE ON TABLE identity_global_role_grants
TO learning_hub_identity_maintenance;
