\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learning_hub_app') THEN
    EXECUTE 'CREATE ROLE learning_hub_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learning_hub_app_local') THEN
    EXECUTE 'CREATE ROLE learning_hub_app_local LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION';
  END IF;
END
$$;

ALTER ROLE learning_hub_app_local PASSWORD 'local_app_password';
GRANT learning_hub_app TO learning_hub_app_local;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
