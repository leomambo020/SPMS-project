const express = require('express');
const rlsRoute = require('../utils/rlsRoute');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post('/login', authLimiter, ctrl.loginValidators, validate, ctrl.login);
router.post('/refresh', authLimiter, ctrl.refresh);
router.post('/logout', ctrl.logout);

router.post(
  '/change-password',
  authLimiter,
  authenticate,
  ctrl.changePasswordValidators,
  validate,
  rlsRoute(ctrl.changePassword)
);

module.exports = router;
