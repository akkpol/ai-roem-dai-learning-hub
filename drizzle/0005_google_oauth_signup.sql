ALTER TABLE "identity_accounts" ALTER COLUMN "age_attested_at" DROP NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION identity_audit_payload_is_safe(
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
      THEN p_payload IN (
        '{"source":"email_password"}'::jsonb,
        '{"source":"google_oauth"}'::jsonb
      )
    WHEN p_action = 'identity.email_verified.v1'
      THEN p_payload IN (
        '{"source":"email_link"}'::jsonb,
        '{"source":"google_oauth"}'::jsonb
      )
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
$$;
