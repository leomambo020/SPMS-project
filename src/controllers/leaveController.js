const { body, query, param } = require('express-validator');
const AppError = require('../utils/AppError');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { leaveDecisionEmail } = require('../services/mailer');

const LEAVE_TYPES = ['annual', 'sick', 'compassionate'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];

const applyLeaveValidators = [
  body('leaveType').isIn(LEAVE_TYPES).withMessage('leaveType must be one of ' + LEAVE_TYPES.join(', ')),
  body('startDate').isISO8601().withMessage('startDate must be a valid date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date.'),
  body('reason').optional().trim(),
];

const decideLeaveValidators = [
  param('id').isInt(),
  body('status').isIn(['approved', 'rejected']).withMessage('status must be approved or rejected.'),
  body('reason').optional().trim(),
];

const listLeaveValidators = [
  query('employeeId').optional().isInt(),
  query('status').optional().isIn(LEAVE_STATUSES),
];

/** Employees may only ever file a request for themselves; HR may file
 * on behalf of anyone (e.g. backdating a documented absence). */
async function applyLeave(req, res, next) {
  try {
    const targetEmployeeId =
      req.user.role === 'hr_admin' && req.body.employeeId ? req.body.employeeId : req.user.employeeId;

    const { leaveType, startDate, endDate, reason } = req.body;

    const { rows } = await req.db.query(
      `INSERT INTO leave_applications (employee_id, leave_type, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING leave_id, employee_id, leave_type, start_date, end_date, status, reason`,
      [targetEmployeeId, leaveType, startDate, endDate, reason ?? null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/** Scope (own / department / all) comes from the leave_select RLS
 * policy; this only adds optional filters. */
async function listLeave(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.employeeId) {
      params.push(req.query.employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await req.db.query(`SELECT COUNT(*) FROM leave_applications ${where}`, params);
    const { rows } = await req.db.query(
      `SELECT leave_id, employee_id, leave_type, start_date, end_date, status, reason, approved_by, decided_at
       FROM leave_applications ${where}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(rows, parseInt(countRows[0].count, 10), { page, limit }));
  } catch (err) {
    next(err);
  }
}

/** Approve/reject. The leave_update RLS policy already confines a
 * supervisor to requests from their own department; requireRole in the
 * route adds a defense-in-depth check that the caller is a supervisor
 * or HR admin at all. */
async function decideLeave(req, res, next) {
  try {
    const { status, reason } = req.body;

    const { rows } = await req.db.query(
      `UPDATE leave_applications
       SET status = $1, reason = COALESCE($2, reason), approved_by = $3, decided_at = now()
       WHERE leave_id = $4
       RETURNING leave_id, employee_id, leave_type, start_date, end_date, status, reason`,
      [status, reason ?? null, req.user.employeeId, req.params.id]
    );

    if (rows.length === 0) {
      return next(new AppError('Leave request not found or not in your department.', 404));
    }

    const decision = rows[0];

    const { rows: contactRows } = await req.db.query(
      `SELECT e.full_name, e.contact_info FROM employees e WHERE e.employee_id = $1`,
      [decision.employee_id]
    );
    if (contactRows[0]) {
      leaveDecisionEmail({
        to: contactRows[0].contact_info,
        employeeName: contactRows[0].full_name,
        status: decision.status,
        reason: decision.reason,
        startDate: decision.start_date,
        endDate: decision.end_date,
      }); // fire-and-forget; failures are logged inside the mailer, never block the response
    }

    res.json(decision);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  applyLeave,
  listLeave,
  decideLeave,
  applyLeaveValidators,
  decideLeaveValidators,
  listLeaveValidators,
};
