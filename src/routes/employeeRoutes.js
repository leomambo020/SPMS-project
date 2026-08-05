const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/employeeController');

const router = express.Router();

// Read scope (self / department / all) is enforced by RLS, so all
// authenticated roles share the same list/get handlers.
router.get('/', ctrl.listEmployeesValidators, validate, rlsRoute(ctrl.listEmployees));
router.get('/:id', rlsRoute(ctrl.getEmployee));

router.post('/', requireRole('hr_admin'), ctrl.createEmployeeValidators, validate, rlsRoute(ctrl.createEmployee));
router.patch(
  '/:id',
  requireRole('hr_admin'),
  ctrl.updateEmployeeValidators,
  validate,
  rlsRoute(ctrl.updateEmployee)
);
router.delete('/:id', requireRole('hr_admin'), rlsRoute(ctrl.deleteEmployee));

module.exports = router;
