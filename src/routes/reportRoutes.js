const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

const router = express.Router();

router.use(requireRole('hr_admin'));

router.get('/staffing', rlsRoute(ctrl.staffingSummary));
router.get('/attendance', rlsRoute(ctrl.attendanceSummary));
router.get('/leave', rlsRoute(ctrl.leaveSummary));
router.get('/payroll', rlsRoute(ctrl.payrollSummary));

module.exports = router;
