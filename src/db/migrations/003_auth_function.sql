-- =====================================================================
-- SPMS: authentication lookup helper
--
-- Problem: at login time there is no authenticated identity yet, so
-- app.current_role/current_employee_id/current_dept_id are all unset,
-- and every RLS policy on user_accounts/employees would (correctly)
-- return zero rows to the low-privilege runtime role. We need one,
-- narrow, deliberate bypass for exactly this lookup.
--
-- Solution: a SECURITY DEFINER function, owned by the schema-owning
-- role (NOT the runtime app role), which runs with the owner's
-- privileges and is therefore unaffected by policies keyed to session
-- variables. It exposes only the columns authentication needs — never
-- a general-purpose "read everything" escape hatch. The runtime role
-- is granted EXECUTE on the function itself, and nothing broader.
-- =====================================================================

CREATE OR REPLACE FUNCTION get_login_credentials(p_username CITEXT)
RETURNS TABLE (
  user_id       INTEGER,
  employee_id   INTEGER,
  password_hash TEXT,
  role          account_role_enum,
  is_active     BOOLEAN,
  dept_id       INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT ua.user_id, ua.employee_id, ua.password_hash, ua.role, ua.is_active, e.dept_id
  FROM user_accounts ua
  JOIN employees e ON e.employee_id = ua.employee_id
  WHERE ua.username = p_username;
$$;

-- Lock the function down: no public access, only the app's runtime
-- role may call it. Replace "spms_app" below with the actual runtime
-- role name used in your deployment (see README.md "Database roles").
REVOKE ALL ON FUNCTION get_login_credentials(CITEXT) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION get_login_credentials(CITEXT) TO spms_app;

-- Same shape, keyed by user_id instead of username — used when
-- rotating a refresh token, so the reissued access token carries the
-- caller's *current* role/department rather than stale JWT claims.
CREATE OR REPLACE FUNCTION get_login_credentials_by_id(p_user_id INTEGER)
RETURNS TABLE (
  user_id       INTEGER,
  employee_id   INTEGER,
  password_hash TEXT,
  role          account_role_enum,
  is_active     BOOLEAN,
  dept_id       INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT ua.user_id, ua.employee_id, ua.password_hash, ua.role, ua.is_active, e.dept_id
  FROM user_accounts ua
  JOIN employees e ON e.employee_id = ua.employee_id
  WHERE ua.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION get_login_credentials_by_id(INTEGER) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION get_login_credentials_by_id(INTEGER) TO spms_app;
