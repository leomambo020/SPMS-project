const express = require('express');
const { authenticate } = require('../middleware/auth');

const authRoutes = require('./authRoutes');
const employeeRoutes = require('./employeeRoutes');
const departmentRoutes = require('./departmentRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveRoutes = require('./leaveRoutes');
const payrollRoutes = require('./payrollRoutes');
const appraisalRoutes = require('./appraisalRoutes');
const reportRoutes = require('./reportRoutes');

const router = express.Router();

// Public (login/refresh/logout are unauthenticated by nature; the
// route file itself protects /change-password with `authenticate`).
router.use('/auth', authRoutes);

// Everything below requires a valid access token.
router.use('/employees', authenticate, employeeRoutes);
router.use('/departments', authenticate, departmentRoutes);
router.use('/attendance', authenticate, attendanceRoutes);
router.use('/leave', authenticate, leaveRoutes);
router.use('/payroll', authenticate, payrollRoutes);
router.use('/appraisals', authenticate, appraisalRoutes);
router.use('/reports', authenticate, reportRoutes);

module.exports = router;
