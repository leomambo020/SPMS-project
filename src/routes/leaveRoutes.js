const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/leaveController');

const router = express.Router();

router.post('/', ctrl.applyLeaveValidators, validate, rlsRoute(ctrl.applyLeave));
router.get('/', ctrl.listLeaveValidators, validate, rlsRoute(ctrl.listLeave));
router.patch(
  '/:id/decision',
  requireRole('supervisor', 'hr_admin'),
  ctrl.decideLeaveValidators,
  validate,
  rlsRoute(ctrl.decideLeave)
);

module.exports = router;
