CREATE OR REPLACE FUNCTION organization_audit_payload_is_safe(
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
      p_payload = '{"fields":"display_name,description,contact_email,locale,time_zone"}'::jsonb
    ELSE false
  END, false)
$$;
