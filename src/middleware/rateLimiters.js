const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/** Global limiter applied to every request — blunt protection against
 * abusive clients and basic denial-of-service traffic. */
const globalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

/** Stricter limiter scoped to authentication endpoints (login, refresh,
 * password change) to slow down credential-stuffing and brute-force
 * attempts specifically. Keyed by IP + submitted username so a single
 * attacker can't drown out other users on the same IP or vice versa. */
const authLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.username) || ''}`,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

module.exports = { globalLimiter, authLimiter };
