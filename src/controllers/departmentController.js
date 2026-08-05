const { body, param } = require('express-validator');
const AppError = require('../utils/AppError');

const createDepartmentValidators = [
  body('deptName').trim().notEmpty().withMessage('deptName is required.'),
  body('supervisorId').optional({ nullable: true }).isInt(),
];

const updateDepartmentValidators = [
  param('id').isInt(),
  body('deptName').optional().trim().notEmpty(),
  body('supervisorId').optional({ nullable: true }).isInt(),
];

/** Readable by any authenticated role — enforced by departments_select. */
async function listDepartments(req, res, next) {
  try {
    const { rows } = await req.db.query(
      `SELECT dept_id, dept_name, supervisor_id FROM departments ORDER BY dept_name`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function getDepartment(req, res, next) {
  try {
    const { rows } = await req.db.query(
      'SELECT dept_id, dept_name, supervisor_id FROM departments WHERE dept_id = $1',
      [req.params.id]
    );
    if (rows.length === 0) return next(new AppError('Department not found.', 404));
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    const { deptName, supervisorId } = req.body;
    const { rows } = await req.db.query(
      `INSERT INTO departments (dept_name, supervisor_id) VALUES ($1, $2)
       RETURNING dept_id, dept_name, supervisor_id`,
      [deptName, supervisorId ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateDepartment(req, res, next) {
  try {
    const sets = [];
    const params = [];
    if (req.body.deptName !== undefined) {
      params.push(req.body.deptName);
      sets.push(`dept_name = $${params.length}`);
    }
    if (req.body.supervisorId !== undefined) {
      params.push(req.body.supervisorId);
      sets.push(`supervisor_id = $${params.length}`);
    }
    if (sets.length === 0) return next(new AppError('No updatable fields provided.', 400));

    params.push(req.params.id);
    const { rows } = await req.db.query(
      `UPDATE departments SET ${sets.join(', ')} WHERE dept_id = $${params.length}
       RETURNING dept_id, dept_name, supervisor_id`,
      params
    );
    if (rows.length === 0) return next(new AppError('Department not found.', 404));
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const { rowCount } = await req.db.query('DELETE FROM departments WHERE dept_id = $1', [req.params.id]);
    if (rowCount === 0) return next(new AppError('Department not found.', 404));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createDepartmentValidators,
  updateDepartmentValidators,
};
