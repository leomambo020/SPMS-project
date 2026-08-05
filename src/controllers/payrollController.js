const { body, query, param } = require('express-validator');
const AppError = require('../utils/AppError');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { payslipReadyEmail } = require('../services/mailer');

const processPayrollValidators = [
  body('employeeId').isInt().withMessage('employeeId is required.'),
  body('month').isISO8601().withMessage('month must be a valid date (use the 1st of the month).'),
  body('basicSalary').isFloat({ min: 0 }).withMessage('basicSalary must be a non-negative number.'),
  body('deductions').optional().isFloat({ min: 0 }),
  body('datePaid').optional({ nullable: true }).isISO8601(),
];

const listPayrollValidators = [param('id').optional().isInt(), query('employeeId').optional().isInt()];

/** Creates or updates (upsert on employee_id + month) a payroll record.
 * HR-only in practice — enforced both by requireRole on the route and
 * by the payroll_write RLS policy. */
async function processPayroll(req, res, next) {
  try {
    const { employeeId, month, basicSalary, deductions = 0, datePaid } = req.body;
    const netPay = Number(basicSalary) - Number(deductions);

    if (netPay < 0) {
      return next(new AppError('Deductions cannot exceed basic salary.', 400));
    }

    const { rows } = await req.db.query(
      `INSERT INTO payroll (employee_id, month, basic_salary, deductions, net_pay, date_paid)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (employee_id, month)
       DO UPDATE SET basic_salary = EXCLUDED.basic_salary, deductions = EXCLUDED.deductions,
                     net_pay = EXCLUDED.net_pay, date_paid = EXCLUDED.date_paid
       RETURNING payroll_id, employee_id, month, basic_salary, deductions, net_pay, date_paid`,
      [employeeId, month, basicSalary, deductions, netPay, datePaid ?? null]
    );
    const record = rows[0];

    const { rows: contactRows } = await req.db.query(
      'SELECT full_name, contact_info FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    if (contactRows[0]) {
      payslipReadyEmail({
        to: contactRows[0].contact_info,
        employeeName: contactRows[0].full_name,
        month: record.month,
      }); // fire-and-forget
    }

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

/** Scope (own record vs. everything) comes from the payroll_select RLS
 * policy — HR admins see all rows, everyone else only their own. */
async function listPayroll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.employeeId) {
      params.push(req.query.employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await req.db.query(`SELECT COUNT(*) FROM payroll ${where}`, params);
    const { rows } = await req.db.query(
      `SELECT payroll_id, employee_id, month, basic_salary, deductions, net_pay, date_paid
       FROM payroll ${where} ORDER BY month DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(rows, parseInt(countRows[0].count, 10), { page, limit }));
  } catch (err) {
    next(err);
  }
}

module.exports = { processPayroll, listPayroll, processPayrollValidators, listPayrollValidators };
