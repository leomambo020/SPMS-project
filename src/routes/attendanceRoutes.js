const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/attendanceController');

const router = express.Router();

// Any authenticated role may call these — RLS confines what they can
// see/write (own record, own department, or everything for HR).
router.post('/', ctrl.markAttendanceValidators, validate, rlsRoute(ctrl.markAttendance));
router.get('/', ctrl.listAttendanceValidators, validate, rlsRoute(ctrl.listAttendance));

module.exports = router;
