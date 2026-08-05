const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/departmentController');

const router = express.Router();

router.get('/', rlsRoute(ctrl.listDepartments));
router.get('/:id', rlsRoute(ctrl.getDepartment));

router.post(
  '/',
  requireRole('hr_admin'),
  ctrl.createDepartmentValidators,
  validate,
  rlsRoute(ctrl.createDepartment)
);
router.patch(
  '/:id',
  requireRole('hr_admin'),
  ctrl.updateDepartmentValidators,
  validate,
  rlsRoute(ctrl.updateDepartment)
);
router.delete('/:id', requireRole('hr_admin'), rlsRoute(ctrl.deleteDepartment));

module.exports = router;
