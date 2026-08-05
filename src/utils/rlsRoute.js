const pool = require('../config/pool');

/**
 * Wraps a route handler in a database transaction that carries the
 * authenticated caller's identity into PostgreSQL session variables,
 * which the row-level security policies (002_rls_policies.sql) key off:
 *
 *   app.current_role         employee | supervisor | hr_admin
 *   app.current_employee_id  the caller's own employee_id
 *   app.current_dept_id      the caller's department (supervisors only)
 *
 * `req.db` becomes the transaction-bound client every controller must
 * use for its queries — never the raw pool — so those variables are
 * guaranteed to be in scope for every statement the handler runs.
 *
 * On success: COMMIT. On any thrown error: ROLLBACK, then forward to
 * the central error handler. The client is always released back to
 * the pool.
 */
function rlsRoute(handler) {
  return async function wrapped(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const role = req.user?.role || '';
      const employeeId = req.user?.employeeId != null ? String(req.user.employeeId) : '';
      const deptId = req.user?.deptId != null ? String(req.user.deptId) : '';

      // set_config(..., true) scopes the setting to the current
      // transaction (LOCAL), so it can never leak to another request
      // sharing this pooled connection later.
      await client.query('SELECT set_config($1, $2, true)', ['app.current_role', role]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_employee_id', employeeId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_dept_id', deptId]);

      req.db = client;

      await handler(req, res, next);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  };
}

module.exports = rlsRoute;
