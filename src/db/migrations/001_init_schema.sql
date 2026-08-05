-- =====================================================================
-- SPMS: Initial schema
-- Run as a table-owning role with normal CREATE privileges (NOT the
-- low-privilege runtime role used by the app — see README.md).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- for case-insensitive usernames

-- ---------- Enum types ----------
DO $$ BEGIN
  CREATE TYPE employment_status_enum AS ENUM ('active', 'on_leave', 'exited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_role_enum AS ENUM ('employee', 'supervisor', 'hr_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status_enum AS ENUM ('present', 'late', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_type_enum AS ENUM ('annual', 'sick', 'compassionate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- updated_at helper ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- Departments ----------
-- supervisor_id FK is added after employees exists (circular reference).
CREATE TABLE IF NOT EXISTS departments (
  dept_id       SERIAL PRIMARY KEY,
  dept_name     TEXT NOT NULL UNIQUE,
  supervisor_id INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Employees ----------
CREATE TABLE IF NOT EXISTS employees (
  employee_id       SERIAL PRIMARY KEY,
  full_name         TEXT NOT NULL,
  dept_id           INTEGER REFERENCES departments(dept_id) ON DELETE SET NULL,
  job_title         TEXT NOT NULL,
  contact_info      TEXT NOT NULL,
  employment_status employment_status_enum NOT NULL DEFAULT 'active',
  date_hired        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_dept_id ON employees(dept_id);

-- Now that employees exists, wire the department -> supervisor FK.
DO $$ BEGIN
  ALTER TABLE departments
    ADD CONSTRAINT fk_departments_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES employees(employee_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- User accounts ----------
CREATE TABLE IF NOT EXISTS user_accounts (
  user_id       SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL UNIQUE REFERENCES employees(employee_id) ON DELETE CASCADE,
  username      CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          account_role_enum NOT NULL DEFAULT 'employee',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Attendance ----------
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in       TIME,
  time_out      TIME,
  status        attendance_status_enum NOT NULL DEFAULT 'present',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- ---------- Leave applications ----------
CREATE TABLE IF NOT EXISTS leave_applications (
  leave_id      SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  leave_type    leave_type_enum NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        leave_status_enum NOT NULL DEFAULT 'pending',
  reason        TEXT,
  approved_by   INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_employee_id ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_applications(status);

-- ---------- Payroll ----------
CREATE TABLE IF NOT EXISTS payroll (
  payroll_id    SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  month         DATE NOT NULL, -- first day of the payroll month, e.g. 2026-07-01
  basic_salary  NUMERIC(12,2) NOT NULL CHECK (basic_salary >= 0),
  deductions    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_pay       NUMERIC(12,2) NOT NULL CHECK (net_pay >= 0),
  date_paid     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON payroll(employee_id);

-- ---------- Appraisals ----------
CREATE TABLE IF NOT EXISTS appraisals (
  appraisal_id  SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  supervisor_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
  period        TEXT NOT NULL, -- e.g. '2026-Q2'
  score         NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  comments      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period)
);

CREATE INDEX IF NOT EXISTS idx_appraisals_employee_id ON appraisals(employee_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_supervisor_id ON appraisals(supervisor_id);

-- ---------- Refresh tokens (for JWT rotation / revocation) ----------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      INTEGER NOT NULL REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ---------- updated_at triggers ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['departments','employees','user_accounts','attendance','leave_applications','payroll','appraisals']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I; CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END $$;
