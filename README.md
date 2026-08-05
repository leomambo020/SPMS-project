# SPMS Backend — Software Personnel Management System

A REST API backend for the SPMS project (Employee, Department Supervisor,
and HR Administrator roles), built with **Node.js / Express / PostgreSQL**
to match the SRS/ERD in `Software_Personnel_Management_System_module_4.docx`.

This has been built and tested end-to-end against a real PostgreSQL
instance with row-level security actually enforced (not simulated) —
see "How this was verified" below.

## Stack

- Node.js + Express
- PostgreSQL (with native Row-Level Security)
- JWT auth (access + rotating refresh tokens), bcrypt password hashing
- express-rate-limit, helmet, cors
- nodemailer (leave decision / payslip notifications)

## Project layout

```
src/
  config/        env loading, PostgreSQL pool
  db/
    migrations/  001 schema, 002 RLS policies, 003 auth lookup function
    migrate.js   migration runner
    seed.js      bootstraps the first HR admin account
  middleware/     auth (JWT), role guard, rate limiters, validation, errors
  services/       token issuance/rotation, email notifications
  controllers/    one per resource (employees, departments, attendance,
                   leave, payroll, appraisals, reports, auth)
  routes/         route wiring per resource + top-level index
  utils/          rlsRoute (the RLS transaction wrapper), pagination, AppError
scripts/
  setup_roles.sql one-time low-privilege DB role setup (see below)
```

## How row-level security actually works here

This is the part worth reading carefully, since it's also the part
most tutorials get wrong.

**The model:** a single low-privilege database role (`spms_app`)
handles every request. Per request, `src/utils/rlsRoute.js` opens a
transaction and sets three PostgreSQL session variables from the
caller's verified JWT claims:

```
app.current_role         employee | supervisor | hr_admin
app.current_employee_id  the caller's own employee_id
app.current_dept_id      the caller's department (supervisors only)
```

Every table's RLS policies (`src/db/migrations/002_rls_policies.sql`)
key off those three variables — e.g. a supervisor can only `SELECT`
attendance rows for employees whose `dept_id` matches
`current_dept_id()`. Controllers never manually filter `WHERE
employee_id = ...` for read-scoping; they just run the query, and
PostgreSQL decides which rows exist for that caller. This was
deliberately built this way instead of doing the scoping in
JavaScript, because RLS holds even if a controller has a bug — an
`SELECT * FROM employees` with no `WHERE` clause at all still only
returns what the caller is allowed to see.

**Why this only works if you set up the database role correctly:**
table owners bypass RLS by default in PostgreSQL. If your Node app
connects using the same role that owns the tables (which is what
happens if you just use one Postgres user for everything), **none of
this RLS enforcement actually applies** — it'll look like it works in
casual testing and then silently do nothing. That's why:

- Migrations run as an **owner** role (see `MIGRATIONS_DATABASE_URL`).
- The app's `DATABASE_URL` must point at a **separate**, low-privilege
  role that does **not** own the tables and does **not** have
  `BYPASSRLS`. Run `scripts/setup_roles.sql` once, manually, as your
  database admin user to create it.

**The login chicken-and-egg problem:** at login time, there's no
identity yet, so the three session variables are unset, and RLS
(correctly) hides `user_accounts` from an anonymous caller. Login uses
a narrow `SECURITY DEFINER` PostgreSQL function
(`get_login_credentials`, in migration 003) that runs with the
table-owner's privileges specifically to look up one account by
username — nothing else is exposed through it, and the runtime role
only gets `EXECUTE` on the function, never blanket `SELECT` on
`user_accounts`.

## Setup

1. **Create the database and an owner role**, then run migrations as
   that owner:
   ```bash
   createdb spms_db
   # DATABASE_URL / MIGRATIONS_DATABASE_URL both point at the owner role for this step
   npm install
   npm run migrate
   ```

2. **Create the low-privilege runtime role** — open
   `scripts/setup_roles.sql`, set a real password, and run it once
   against your database as the admin user:
   ```bash
   psql -d spms_db -f scripts/setup_roles.sql
   ```
   Verify it worked:
   ```sql
   SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'spms_app';
   -- rolbypassrls and rolsuper must both be false
   ```

3. **Set `.env`** (copy `.env.example`) — `DATABASE_URL` should now
   point at `spms_app`, not the owner role. Set real JWT secrets
   (32+ random characters each).

4. **Seed the first HR admin**:
   ```bash
   SEED_HR_USERNAME=admin SEED_HR_PASSWORD='SomeStrongPassword123!' node src/db/seed.js
   ```

5. **Run it**:
   ```bash
   npm run dev   # or: npm start
   ```

## API summary

All routes are under `/api`. Every route except `/auth/login`,
`/auth/refresh`, and `/auth/logout` requires `Authorization: Bearer
<accessToken>`.

| Method & path | Who | Notes |
|---|---|---|
| POST `/auth/login` | anyone | returns access + refresh token |
| POST `/auth/refresh` | anyone (with valid refresh token) | rotates the refresh token |
| POST `/auth/logout` | anyone | revokes the given refresh token |
| POST `/auth/change-password` | authenticated | re-verifies current password, revokes other sessions |
| GET `/employees` `/employees/:id` | all roles | scope enforced by RLS |
| POST/PATCH/DELETE `/employees` | HR only | can create a login account atomically |
| GET `/departments` | all roles | |
| POST/PATCH/DELETE `/departments` | HR only | |
| POST `/attendance` | all roles | upserts today's (or a given date's) punch |
| GET `/attendance` | all roles | scope enforced by RLS, optional filters |
| POST `/leave` | all roles | employee always files for themselves |
| GET `/leave` | all roles | scope enforced by RLS |
| PATCH `/leave/:id/decision` | supervisor (own dept), HR | approve/reject, emails the employee |
| POST `/payroll` | HR only | upsert per employee/month, emails a "payslip ready" notice |
| GET `/payroll` | all roles | HR sees all, others only their own |
| POST `/appraisals` | supervisor (own dept), HR | upsert per employee/period |
| GET `/appraisals` | all roles | scope enforced by RLS |
| GET `/reports/staffing|attendance|leave|payroll` | HR only | aggregate views |

Full request/response bodies are enforced via `express-validator` in
each controller file (e.g. `createEmployeeValidators`).

## Security measures implemented

- **Row-level security** (above) as the primary access-control
  mechanism, with route-level `requireRole()` guards as defense in
  depth — so a bug in one layer doesn't remove the other.
- **Password hashing** with bcrypt (12 rounds by default), enforced
  minimum length on change.
- **JWT access tokens** (short-lived, 15 min default) +
  **rotating refresh tokens** stored hashed (SHA-256) in `refresh_tokens`,
  revoked on use (rotation) and revoked-on-reuse-detection: reusing an
  already-rotated refresh token revokes every token for that user, on
  the assumption it was stolen.
- **Rate limiting**: a global limiter on all traffic, plus a much
  stricter limiter specifically on `/auth/login`, `/auth/refresh`, and
  `/auth/change-password` to slow down credential stuffing.
- **Parameterized queries everywhere** (no string-built SQL), so
  standard SQL injection isn't possible through this API.
- **helmet** for standard security headers, **cors** locked to
  `CLIENT_ORIGIN`.
- **Centralized error handling** that never leaks stack traces or
  internal detail in production, and translates PostgreSQL constraint
  violations (unique/FK/check) and RLS-denial errors into clean,
  non-revealing HTTP responses.
- **Timing-safe-ish login**: a failed login always runs a bcrypt
  compare (against a dummy hash if the username doesn't exist) so
  response timing doesn't reveal which usernames are registered.

## How this was verified

This backend was actually run — not just written — against a real
PostgreSQL 16 instance, with two distinct database roles (an owning
role for migrations, and a genuinely non-superuser/non-bypass
`spms_app` role for the running app), through the following scenarios:

- HR creates departments, a supervisor, and two employees split across
  two different departments.
- A supervisor's employee list correctly includes only their own
  department; fetching an employee from another department by ID
  correctly 404s (RLS hides the row rather than the app checking and
  blocking it).
- A plain employee's employee list correctly includes only themselves.
- An employee filing a leave request with a spoofed `employeeId` for a
  different employee is correctly forced back to their own ID.
- A supervisor approving a leave request from an employee in **their**
  department succeeds; the same supervisor attempting to decide a
  request from a **different** department correctly 404s.
- A plain employee attempting to create another employee record is
  correctly blocked with 403.
- Payroll: an employee sees only their own payroll record; a
  colleague's payroll record is correctly invisible to them; HR sees
  aggregate totals across everyone.
- A non-HR caller hitting an HR-only report endpoint is correctly
  blocked with 403.

One real bug was caught and fixed during this process: PostgreSQL's
`COALESCE($param, 'enum_literal')` fails to type-check when `$param`
is `NULL` and sent without an explicit cast, because the driver sends
untyped nulls as `text` — fixed by casting (`$5::employment_status_enum`,
etc.) in the employee and attendance insert queries.

## Notes / things you'll likely want to adjust

- `contact_info` on `employees` is used as the notification email
  address in `leaveDecisionEmail` / `payslipReadyEmail`. If you want a
  dedicated `email` column separate from general contact info, that's
  a small schema/controller change.
- Hard `DELETE /employees/:id` cascades to attendance, leave, payroll,
  appraisals, and the login account. For routine offboarding, prefer
  `PATCH /employees/:id` with `employmentStatus: "exited"` instead.
- SMTP is optional — if `SMTP_HOST` isn't reachable, notification
  emails fail silently (logged, not thrown) so leave/payroll actions
  never fail because of a notification problem.
#   S P M S - p r o j e c t  
 #   S P M S - p r o j e c t  
 