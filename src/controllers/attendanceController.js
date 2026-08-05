const { body, query } = require('express-validator');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const ATTENDANCE_STATUSES = ['present', 'late', 'absent'];

const markAttendanceValidators = [
  body('date').optional().isISO8601(),
  body('timeIn').optional({ nullable: true }).matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('timeOut').optional({ nullable: true }).matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('status').optional().isIn(ATTENDANCE_STATUSES),
  // HR may record attendance on behalf of any employee; the
  // attendance_insert RLS policy still enforces that a plain
  // "employee" caller may only ever write employeeId = themselves.
  body('employeeId').optional().isInt(),
];

const listAttendanceValidators = [
  query('employeeId').optional().isInt(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('status').optional().isIn(ATTENDANCE_STATUSES),
];

/** Upserts today's (or a specified date's) punch record for an
 * employee. Row visibility/writability across roles is governed by
 * the attendance RLS policies — this just picks the right employee_id. */
async function markAttendance(req, res, next) {
  try {
    const targetEmployeeId =
      req.user.role !== 'employee' && req.body.employeeId ? req.body.employeeId : req.user.employeeId;

    const { date, timeIn, timeOut, status } = req.body;

    const { rows } = await req.db.query(
      `INSERT INTO attendance (employee_id, date, time_in, time_out, status)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, COALESCE($5::attendance_status_enum, 'present'))
       ON CONFLICT (employee_id, date)
       DO UPDATE SET
         time_in = COALESCE(EXCLUDED.time_in, attendance.time_in),
         time_out = COALESCE(EXCLUDED.time_out, attendance.time_out),
         status = EXCLUDED.status
       RETURNING attendance_id, employee_id, date, time_in, time_out, status`,
      [targetEmployeeId, date, timeIn ?? null, timeOut ?? null, status]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/** Scope (own / department / all) comes entirely from RLS; this just
 * layers optional filters on top. */
async function listAttendance(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.employeeId) {
      params.push(req.query.employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom);
      conditions.push(`date >= $${params.length}`);
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo);
      conditions.push(`date <= $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await req.db.query(`SELECT COUNT(*) FROM attendance ${where}`, params);
    const { rows } = await req.db.query(
      `SELECT attendance_id, employee_id, date, time_in, time_out, status
       FROM attendance ${where} ORDER BY date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(rows, parseInt(countRows[0].count, 10), { page, limit }));
  } catch (err) {
    next(err);
  }
}

module.exports = { markAttendance, listAttendance, markAttendanceValidators, listAttendanceValidators };
