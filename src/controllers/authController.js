const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const pool = require('../config/pool');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const tokenService = require('../services/tokenService');

const loginValidators = [
  body('username').trim().notEmpty().withMessage('Username is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    // Uses the raw pool directly: at this point there is no
    // authenticated identity, so this can't go through rlsRoute(), and
    // deliberately bypasses per-row RLS via a narrow SECURITY DEFINER
    // function (see migrations/003_auth_function.sql).
    const { rows } = await pool.query('SELECT * FROM get_login_credentials($1)', [username]);
    const account = rows[0];

    // Constant-shape response whether the username exists or not, to
    // avoid leaking which usernames are registered.
    if (!account || !account.is_active) {
      // Still run a bcrypt compare against a dummy hash so response
      // timing doesn't reveal whether the username exists.
      await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
      return next(new AppError('Invalid username or password.', 401));
    }

    const passwordMatches = await bcrypt.compare(password, account.password_hash);
    if (!passwordMatches) {
      return next(new AppError('Invalid username or password.', 401));
    }

    const userSnapshot = {
      userId: account.user_id,
      employeeId: account.employee_id,
      role: account.role,
      deptId: account.dept_id,
    };

    const { accessToken, refreshToken } = await tokenService.issueTokenPair(userSnapshot);

    res.json({
      accessToken,
      refreshToken,
      user: { employeeId: account.employee_id, role: account.role },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(new AppError('refreshToken is required.', 400));

    // Decode without verifying signature just to pull the user id for
    // the fresh-claims lookup; rotateRefreshToken() below performs the
    // real signature/expiry/revocation verification.
    let unverifiedUserId;
    try {
      unverifiedUserId = jwt.decode(refreshToken)?.sub;
    } catch {
      return next(new AppError('Invalid refresh token.', 401));
    }
    if (!unverifiedUserId) return next(new AppError('Invalid refresh token.', 401));

    const { rows } = await pool.query('SELECT * FROM get_login_credentials_by_id($1)', [unverifiedUserId]);
    const account = rows[0];
    if (!account || !account.is_active) {
      return next(new AppError('Account is no longer active.', 401));
    }

    const userSnapshot = {
      userId: account.user_id,
      employeeId: account.employee_id,
      role: account.role,
      deptId: account.dept_id,
    };

    const tokens = await tokenService.rotateRefreshToken(refreshToken, userSnapshot);
    res.json(tokens);
  } catch (err) {
    next(new AppError(err.message || 'Could not refresh session.', err.statusCode || 401));
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await tokenService.revokeToken(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

const changePasswordValidators = [
  body('currentPassword').notEmpty().withMessage('currentPassword is required.'),
  body('newPassword')
    .isLength({ min: 10 })
    .withMessage('New password must be at least 10 characters.'),
];

/** Self-service password change. Requires the caller to already be
 * authenticated (authenticate + rlsRoute), and re-verifies the current
 * password server-side rather than trusting the JWT alone. */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await req.db.query(
      'SELECT user_id, password_hash FROM user_accounts WHERE employee_id = $1',
      [req.user.employeeId]
    );
    const account = rows[0];
    if (!account) return next(new AppError('Account not found.', 404));

    const matches = await bcrypt.compare(currentPassword, account.password_hash);
    if (!matches) return next(new AppError('Current password is incorrect.', 401));

    const newHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
    await req.db.query('UPDATE user_accounts SET password_hash = $1 WHERE user_id = $2', [
      newHash,
      account.user_id,
    ]);

    // Invalidate all outstanding refresh tokens so other sessions are
    // forced to re-authenticate with the new password.
    await tokenService.revokeAllForUser(account.user_id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, changePassword, loginValidators, changePasswordValidators };
