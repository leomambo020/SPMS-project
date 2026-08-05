const { body, query } = require('express-validator');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const submitAppraisalValidators = [
  body('employeeId').isInt().withMessage('employeeId is required.'),
  body('period').trim().notEmpty().withMessage('period is required, e.g. "2026-Q2".'),
  body('score').isFloat({ min: 0, max: 100 }).withMessage('score must be between 0 and 100.'),
  body('comments').optional().trim(),
];

const listAppraisalsValidators = [query('employeeId').optional().isInt()];

/** Upserts on (employee_id, period). The appraisals_insert RLS policy
 * already restricts a supervisor to appraising employees in their own
 * department and stamps them as the author; this sets supervisor_id to
 * the caller so that constraint has something to check against. */
async function submitAppraisal(req, res, next) {
  try {
    const { employeeId, period, score, comments } = req.body;
    const supervisorId =
      req.user.role === 'hr_admin' && req.body.supervisorId ? req.body.supervisorId : req.user.employeeId;

    const { rows } = await req.db.query(
      `INSERT INTO appraisals (employee_id, supervisor_id, period, score, comments)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (employee_id, period)
       DO UPDATE SET score = EXCLUDED.score, comments = EXCLUDED.comments, supervisor_id = EXCLUDED.supervisor_id
       RETURNING appraisal_id, employee_id, supervisor_id, period, score, comments`,
      [employeeId, supervisorId, period, score, comments ?? null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/** Scope comes from the appraisals_select RLS policy: HR sees all,
 * supervisors see their department's (or ones they authored), employees
 * see only their own appraisal history. */
async function listAppraisals(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.employeeId) {
      params.push(req.query.employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await req.db.query(`SELECT COUNT(*) FROM appraisals ${where}`, params);
    const { rows } = await req.db.query(
      `SELECT appraisal_id, employee_id, supervisor_id, period, score, comments
       FROM appraisals ${where} ORDER BY period DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(rows, parseInt(countRows[0].count, 10), { page, limit }));
  } catch (err) {
    next(err);
  }
}

module.exports = { submitAppraisal, listAppraisals, submitAppraisalValidators, listAppraisalsValidators };
