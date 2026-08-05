-- =====================================================================
-- SPMS: one-time database role setup
--
-- Run this ONCE, manually, connected as your database's admin/owner
-- user (e.g. the default user Render/Railway/Vercel Postgres gives
-- you) — NOT as part of the automatic migration runner. Migrations
-- create and own the tables; this script creates a second, weaker
-- role that your Node app actually connects as. That separation is
-- what makes row-level security real: table owners bypass RLS by
-- default, so the app must never connect as the owner.
--
-- Replace 'change_this_password' with a strong, generated secret
-- before running, and put the resulting connection string in
-- DATABASE_URL for the app (not the admin/owner credentials).
-- =====================================================================

CREATE ROLE spms_app WITH LOGIN PASSWORD 'change_this_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE spms_db TO spms_app;
GRANT USAGE ON SCHEMA public TO spms_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  departments, employees, user_accounts, attendance,
  leave_applications, payroll, appraisals, refresh_tokens
TO spms_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO spms_app;

GRANT EXECUTE ON FUNCTION get_login_credentials(CITEXT) TO spms_app;
GRANT EXECUTE ON FUNCTION get_login_credentials_by_id(INTEGER) TO spms_app;

-- Sanity check: this role must NOT have BYPASSRLS and must NOT own any
-- of the tables above. Verify with:
--   SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'spms_app';
--   SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public';
