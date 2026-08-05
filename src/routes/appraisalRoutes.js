const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/appraisalController');

const router = express.Router();

router.post(
  '/',
  requireRole('supervisor', 'hr_admin'),
  ctrl.submitAppraisalValidators,
  validate,
  rlsRoute(ctrl.submitAppraisal)
);
router.get('/', ctrl.listAppraisalsValidators, validate, rlsRoute(ctrl.listAppraisals));

module.exports = router;
