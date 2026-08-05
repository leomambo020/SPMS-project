/** Aggregate HR reports. Restricted to hr_admin via requireRole on the
 * route; RLS is a second line of defense (a non-HR caller would only
 * ever aggregate their own visible rows even if this guard were
 * somehow bypassed, never see other employees' data). */

async function staffingSummary(req, res, next) {
  try {
    const { rows } = await req.db.query(`
      SELECT d.dept_id, d.dept_name, COUNT(e.employee_id) AS headcount,
             COUNT(*) FILTER (WHERE e.employment_status = 'active') AS active_count,
             COUNT(*) FILTER (WHERE e.employment_status = 'on_leave') AS on_leave_count,
             COUNT(*) FILTER (WHERE e.employment_status = 'exited') AS exited_count
      FROM departments d
      LEFT JOIN employees e ON e.dept_id = d.dept_id
      GROUP BY d.dept_id, d.dept_name
      ORDER BY d.dept_name
    `);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function attendanceSummary(req, res, next) {
  try {
    const { dateFrom, dateTo } = req.query;
    const conditions = [];
    const params = [];
    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`date >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`date <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await req.db.query(
      `SELECT status, COUNT(*) AS count FROM attendance ${where} GROUP BY status ORDER BY status`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function leaveSummary(req, res, next) {
  try {
    const { rows } = await req.db.query(`
      SELECT leave_type, status, COUNT(*) AS count
      FROM leave_applications
      GROUP BY leave_type, status
      ORDER BY leave_type, status
    `);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function payrollSummary(req, res, next) {
  try {
    const { rows } = await req.db.query(`
      SELECT to_char(month, 'YYYY-MM') AS month,
             COUNT(*) AS employees_paid,
             SUM(basic_salary) AS total_basic_salary,
             SUM(deductions) AS total_deductions,
             SUM(net_pay) AS total_net_pay
      FROM payroll
      GROUP BY month
      ORDER BY month DESC
    `);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { staffingSummary, attendanceSummary, leaveSummary, payrollSummary };
