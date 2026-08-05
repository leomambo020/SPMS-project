const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Verifies the access token and attaches the caller's identity to
 * req.user. This identity is what rlsRoute() later feeds into
 * PostgreSQL session variables for row-level security, so the claims
 * embedded at login/refresh time (employeeId, role, deptId) are the
 * single source of truth for authorization for the lifetime of that
 * token. A role or department change takes effect on next login/refresh.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Missing or malformed Authorization header.', 401));
  }

  jwt.verify(token, env.jwtAccessSecret, (err, payload) => {
    if (err) {
      const message = err.name === 'TokenExpiredError' ? 'Access token expired.' : 'Invalid access token.';
      return next(new AppError(message, 401));
    }

    req.user = {
      userId: payload.sub,
      employeeId: payload.employeeId,
      role: payload.role,
      deptId: payload.deptId ?? null,
    };

    next();
  });
}

/** Defense-in-depth role guard for use alongside RLS, not instead of it. */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
