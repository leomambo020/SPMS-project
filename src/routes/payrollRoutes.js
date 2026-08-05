const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/payrollController');

const router = express.Router();

router.post(
  '/',
  requireRole('hr_admin'),
  ctrl.processPayrollValidators,
  validate,
  rlsRoute(ctrl.processPayroll)
);
router.get('/', ctrl.listPayrollValidators, validate, rlsRoute(ctrl.listPayroll));

module.exports = router;
