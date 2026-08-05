-- =====================================================================
-- SPMS: Row-Level Security policies
--
-- Model: a single low-privilege runtime role (e.g. "spms_app") connects
-- for every request. Per request, the app sets three transaction-local
-- session variables (see src/utils/rlsRoute.js):
--   app.current_role         -> 'employee' | 'supervisor' | 'hr_admin'
--   app.current_employee_id  -> the caller's own employee_id
--   app.current_dept_id      -> the caller's department (supervisors only)
--
-- IMPORTANT: the runtime role must NOT be a superuser, must NOT own
-- these tables, and must NOT have the BYPASSRLS attribute, or none of
-- this applies. See README.md "Database roles" section.
-- =====================================================================

CREATE OR REPLACE FUNCTION current_role_name() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_role', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_employee_id() RETURNS INTEGER AS $$
  SELECT NULLIF(current_setting('app.current_employee_id', true), '')::INTEGER;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_dept_id() RETURNS INTEGER AS $$
  SELECT NULLIF(current_setting('app.current_dept_id', true), '')::INTEGER;
$$ LANGUAGE sql STABLE;

-- =====================================================================
-- DEPARTMENTS: readable by any authenticated caller, writable by HR only
-- =====================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_select ON departments;
CREATE POLICY departments_select ON departments FOR SELECT
  USING (current_role_name() IS NOT NULL);

DROP POLICY IF EXISTS departments_write ON departments;
CREATE POLICY departments_write ON departments FOR ALL
  USING (current_role_name() = 'hr_admin')
  WITH CHECK (current_role_name() = 'hr_admin');

-- =====================================================================
-- EMPLOYEES: HR sees/edits all; supervisors see their own department;
-- employees see only their own record.
-- =====================================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select ON employees;
CREATE POLICY employees_select ON employees FOR SELECT
  USING (
    current_role_name() = 'hr_admin'
    OR employee_id = current_employee_id()
    OR (current_role_name() = 'supervisor' AND dept_id = current_dept_id())
  );

DROP POLICY IF EXISTS employees_insert ON employees;
CREATE POLICY employees_insert ON employees FOR INSERT
  WITH CHECK (current_role_name() = 'hr_admin');

DROP POLICY IF EXISTS employees_update ON employees;
CREATE POLICY employees_update ON employees FOR UPDATE
  USING (current_role_name() = 'hr_admin')
  WITH CHECK (current_role_name() = 'hr_admin');

DROP POLICY IF EXISTS employees_delete ON employees;
CREATE POLICY employees_delete ON employees FOR DELETE
  USING (current_role_name() = 'hr_admin');

-- =====================================================================
-- USER_ACCOUNTS: HR manages all; a caller may read/update their own
-- account row (application layer restricts self-service updates to
-- password changes only — see controllers/authController.js).
-- =====================================================================
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_accounts_select ON user_accounts;
CREATE POLICY user_accounts_select ON user_accounts FOR SELECT
  USING (
    current_role_name() = 'hr_admin'
    OR employee_id = current_employee_id()
  );

DROP POLICY IF EXISTS user_accounts_insert ON user_accounts;
CREATE POLICY user_accounts_insert ON user_accounts FOR INSERT
  WITH CHECK (current_role_name() = 'hr_admin');

DROP POLICY IF EXISTS user_accounts_update ON user_accounts;
CREATE POLICY user_accounts_update ON user_accounts FOR UPDATE
  USING (current_role_name() = 'hr_admin' OR employee_id = current_employee_id())
  WITH CHECK (current_role_name() = 'hr_admin' OR employee_id = current_employee_id());

DROP POLICY IF EXISTS user_accounts_delete ON user_accounts;
CREATE POLICY user_accounts_delete ON user_accounts FOR DELETE
  USING (current_role_name() = 'hr_admin');

-- =====================================================================
-- ATTENDANCE: HR sees/edits all; supervisors see their department;
-- employees see and punch only their own record.
-- =====================================================================
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_select ON attendance;
CREATE POLICY attendance_select ON attendance FOR SELECT
  USING (
    current_role_name() = 'hr_admin'
    OR employee_id = current_employee_id()
    OR (
      current_role_name() = 'supervisor'
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.employee_id = attendance.employee_id AND e.dept_id = current_dept_id()
      )
    )
  );

DROP POLICY IF EXISTS attendance_insert ON attendance;
CREATE POLICY attendance_insert ON attendance FOR INSERT
  WITH CHECK (
    current_role_name() = 'hr_admin'
    OR (current_role_name() = 'employee' AND employee_id = current_employee_id())
  );

DROP POLICY IF EXISTS attendance_update ON attendance;
CREATE POLICY attendance_update ON attendance FOR UPDATE
  USING (current_role_name() = 'hr_admin')
  WITH CHECK (current_role_name() = 'hr_admin');

DROP POLICY IF EXISTS attendance_delete ON attendance;
CREATE POLICY attendance_delete ON attendance FOR DELETE
  USING (current_role_name() = 'hr_admin');

-- =====================================================================
-- LEAVE_APPLICATIONS: HR all; supervisors see + decide on their dept's
-- requests; employees see + create only their own.
-- =====================================================================
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_select ON leave_applications;
CREATE POLICY leave_select ON leave_applications FOR SELECT
  USING (
    current_role_name() = 'hr_admin'
    OR employee_id = current_employee_id()
    OR (
      current_role_name() = 'supervisor'
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.employee_id = leave_applications.employee_id AND e.dept_id = current_dept_id()
      )
    )
  );

DROP POLICY IF EXISTS leave_insert ON leave_applications;
CREATE POLICY leave_insert ON leave_applications FOR INSERT
  WITH CHECK (
    current_role_name() = 'hr_admin'
    OR (current_role_name() = 'employee' AND employee_id = current_employee_id())
  );

-- Supervisors may only update (decide) requests from their own department;
-- HR may update any. Application layer restricts which columns a
-- supervisor is allowed to send (status, reason, approved_by, decided_at).
DROP POLICY IF EXISTS leave_update ON leave_applications;
CREATE POLICY leave_update ON leave_applications FOR UPDATE
  USING (
    current_role_name() = 'hr_admin'
    OR (
      current_role_name() = 'supervisor'
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.employee_id = leave_applications.employee_id AND e.dept_id = current_dept_id()
      )
    )
  )
  WITH CHECK (
    current_role_name() = 'hr_admin'
    OR (
      current_role_name() = 'supervisor'
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.employee_id = leave_applications.employee_id AND e.dept_id = current_dept_id()
      )
    )
  );

DROP POLICY IF EXISTS leave_delete ON leave_applications;
CREATE POLICY leave_delete ON leave_applications FOR DELETE
  USING (current_role_name() = 'hr_admin');

-- =====================================================================
-- PAYROLL: HR processes and sees all; employees see only their own.
-- =====================================================================
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_select ON payroll;
CREATE POLICY payroll_select ON payroll FOR SELECT
  USING (
    current_role_name() = 'hr_admin'
    OR employee_id = current_employee_id()
  );

DROP POLICY IF EXISTS payroll_write ON payroll;
CREATE POLICY payroll_write ON payroll FOR ALL
  USING (current_role_name() = 'hr_admin')
  WITH CHECK (current_role_name() = 'hr_admin');

-- =====================================================================
-- APPRAISALS: HR all; supervisors manage appraisals for their own
-- department's employees (or ones they personally authored); employees
-- read only their own appraisal history.
-- =====================================================================
ALTER TABLE appraisals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appraisals_select ON appraisals;
CREATE POLICY appraisals_select ON appraisals FOR SELECT
  USING (
    current_role_name() = 'hr_admin'
    OR employee_id = current_employee_id()
    OR supervisor_id = current_employee_id()
    OR (
      current_role_name() = 'supervisor'
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.employee_id = appraisals.employee_id AND e.dept_id = current_dept_id()
      )
    )
  );

DROP POLICY IF EXISTS appraisals_insert ON appraisals;
CREATE POLICY appraisals_insert ON appraisals FOR INSERT
  WITH CHECK (
    current_role_name() = 'hr_admin'
    OR (
      current_role_name() = 'supervisor'
      AND supervisor_id = current_employee_id()
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.employee_id = appraisals.employee_id AND e.dept_id = current_dept_id()
      )
    )
  );

DROP POLICY IF EXISTS appraisals_update ON appraisals;
CREATE POLICY appraisals_update ON appraisals FOR UPDATE
  USING (current_role_name() = 'hr_admin' OR supervisor_id = current_employee_id())
  WITH CHECK (current_role_name() = 'hr_admin' OR supervisor_id = current_employee_id())
;

DROP POLICY IF EXISTS appraisals_delete ON appraisals;
CREATE POLICY appraisals_delete ON appraisals FOR DELETE
  USING (current_role_name() = 'hr_admin');

-- =====================================================================
-- REFRESH_TOKENS: intentionally NOT given a per-caller RLS policy.
-- This table holds a token lifecycle, not business data scoped to an
-- employee/department/HR view, and it is never touched inside an
-- rlsRoute()-wrapped request — only by tokenService.js, using the raw
-- pool directly (login, refresh, logout). Keeping it outside the RLS
-- model here avoids a false sense of protection: the real controls
-- for this table are that (a) it's only reachable from tokenService.js,
-- never from a route that accepts arbitrary user-supplied queries, and
-- (b) stored values are salted hashes of the refresh tokens, not the
-- tokens themselves, so a row disclosure alone is not a takeover.
