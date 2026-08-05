const bcrypt = require('bcrypt');
const { body, param, query } = require('express-validator');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'exited'];
const ACCOUNT_ROLES = ['employee', 'supervisor', 'hr_admin'];

const createEmployeeValidators = [
  body('fullName').trim().notEmpty().withMessage('fullName is required.'),
  body('jobTitle').trim().notEmpty().withMessage('jobTitle is required.'),
  body('contactInfo').trim().notEmpty().withMessage('contactInfo is required.'),
  body('deptId').optional({ nullable: true }).isInt().withMessage('deptId must be an integer.'),
  body('employmentStatus').optional().isIn(EMPLOYMENT_STATUSES),
  body('dateHired').optional().isISO8601().withMessage('dateHired must be a valid date.'),
  body('account').optional().isObject(),
  body('account.username').if(body('account').exists()).trim().notEmpty(),
  body('account.password').if(body('account').exists()).isLength({ min: 10 }),
  body('account.role').if(body('account').exists()).isIn(ACCOUNT_ROLES),
];

const updateEmployeeValidators = [
  param('id').isInt(),
  body('fullName').optional().trim().notEmpty(),
  body('jobTitle').optional().trim().notEmpty(),
  body('contactInfo').optional().trim().notEmpty(),
  body('deptId').optional({ nullable: true }).isInt(),
  body('employmentStatus').optional().isIn(EMPLOYMENT_STATUSES),
];

const listEmployeesValidators = [
  query('deptId').optional().isInt(),
  query('employmentStatus').optional().isIn(EMPLOYMENT_STATUSES),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

/** Read scope (own record / own department / everything) is entirely
 * enforced by the employees_select RLS policy — this handler only adds
 * optional filters on top of whatever rows the caller is allowed to see. */
async function listEmployees(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.deptId) {
      params.push(req.query.deptId);
      conditions.push(`dept_id = $${params.length}`);
    }
    if (req.query.employmentStatus) {
      params.push(req.query.employmentStatus);
      conditions.push(`employment_status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await req.db.query(`SELECT COUNT(*) FROM employees ${where}`, params);
    const { rows } = await req.db.query(
      `SELECT employee_id, full_name, dept_id, job_title, contact_info, employment_status, date_hired
       FROM employees ${where} ORDER BY full_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(rows, parseInt(countRows[0].count, 10), { page, limit }));
  } catch (err) {
    next(err);
  }
}

async function getEmployee(req, res, next) {
  try {
    const { rows } = await req.db.query(
      `SELECT employee_id, full_name, dept_id, job_title, contact_info, employment_status, date_hired
       FROM employees WHERE employee_id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return next(new AppError('Employee not found.', 404));
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/** Creates an employee record and, optionally, its login account in
 * one atomic operation (req.db is already inside rlsRoute's
 * transaction, so either both succeed or neither does). */
async function createEmployee(req, res, next) {
  try {
    const { fullName, deptId, jobTitle, contactInfo, employmentStatus, dateHired, account } = req.body;

    const { rows } = await req.db.query(
      `INSERT INTO employees (full_name, dept_id, job_title, contact_info, employment_status, date_hired)
       VALUES ($1, $2, $3, $4, COALESCE($5::employment_status_enum, 'active'), COALESCE($6::date, CURRENT_DATE))
       RETURNING employee_id, full_name, dept_id, job_title, contact_info, employment_status, date_hired`,
      [fullName, deptId ?? null, jobTitle, contactInfo, employmentStatus, dateHired]
    );
    const employee = rows[0];

    let createdAccount;
    if (account) {
      const passwordHash = await bcrypt.hash(account.password, env.bcryptSaltRounds);
      const { rows: acctRows } = await req.db.query(
        `INSERT INTO user_accounts (employee_id, username, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, username, role`,
        [employee.employee_id, account.username, passwordHash, account.role]
      );
      createdAccount = acctRows[0];
    }

    res.status(201).json({ ...employee, account: createdAccount });
  } catch (err) {
    next(err);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const fields = ['fullName', 'deptId', 'jobTitle', 'contactInfo', 'employmentStatus'];
    const columnMap = {
      fullName: 'full_name',
      deptId: 'dept_id',
      jobTitle: 'job_title',
      contactInfo: 'contact_info',
      employmentStatus: 'employment_status',
    };

    const sets = [];
    const params = [];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        params.push(req.body[field]);
        sets.push(`${columnMap[field]} = $${params.length}`);
      }
    }

    if (sets.length === 0) return next(new AppError('No updatable fields provided.', 400));

    params.push(req.params.id);
    const { rows } = await req.db.query(
      `UPDATE employees SET ${sets.join(', ')} WHERE employee_id = $${params.length}
       RETURNING employee_id, full_name, dept_id, job_title, contact_info, employment_status, date_hired`,
      params
    );

    if (rows.length === 0) return next(new AppError('Employee not found.', 404));
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/** Hard delete — cascades to attendance, leave, payroll, appraisals,
 * and the login account. Prefer PATCH employmentStatus='exited' for
 * routine offboarding; this is for correcting mistaken records. */
async function deleteEmployee(req, res, next) {
  try {
    const { rowCount } = await req.db.query('DELETE FROM employees WHERE employee_id = $1', [req.params.id]);
    if (rowCount === 0) return next(new AppError('Employee not found.', 404));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  createEmployeeValidators,
  updateEmployeeValidators,
  listEmployeesValidators,
};
