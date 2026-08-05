const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/pool');
const env = require('../config/env');

/** Deterministic, fast hash for refresh tokens: these are high-entropy
 * random values (not user passwords), so SHA-256 for storage + lookup
 * is appropriate; bcrypt's slow, salted design is unnecessary here and
 * would make refresh-token lookups needlessly expensive. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.userId, employeeId: user.employeeId, role: user.role, deptId: user.deptId ?? null },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.userId }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn });
}

function expiryDateFromJwt(token, secret) {
  const decoded = jwt.verify(token, secret);
  return new Date(decoded.exp * 1000);
}

/** Issues a fresh access + refresh token pair and persists the refresh
 * token's hash so it can be revoked or checked for reuse later. Uses
 * the raw pool directly — refresh-token bookkeeping is a trusted,
 * server-only concern and is not scoped by row-level security (see
 * migrations/002_rls_policies.sql). */
async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const expiresAt = expiryDateFromJwt(refreshToken, env.jwtRefreshSecret);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.userId, hashToken(refreshToken), expiresAt]
  );

  return { accessToken, refreshToken };
}

/** Verifies a refresh token's signature AND that it hasn't been
 * revoked or already rotated away, then rotates it (old token revoked,
 * new pair issued). Rotation on every use limits the blast radius of a
 * stolen refresh token to a single use. */
async function rotateRefreshToken(refreshToken, currentUserSnapshot) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.jwtRefreshSecret);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token.'), { statusCode: 401 });
  }

  const tokenHash = hashToken(refreshToken);
  const { rows } = await pool.query(
    'SELECT id, revoked FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2',
    [tokenHash, decoded.sub]
  );

  if (rows.length === 0 || rows[0].revoked) {
    // Reuse of a revoked/rotated-away token is a strong signal of theft:
    // revoke every outstanding token for this user as a precaution.
    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [decoded.sub]);
    throw Object.assign(new Error('Refresh token has been revoked. Please log in again.'), { statusCode: 401 });
  }

  await pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [rows[0].id]);

  return issueTokenPair(currentUserSnapshot);
}

async function revokeAllForUser(userId) {
  await pool.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);
}

async function revokeToken(refreshToken) {
  await pool.query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [hashToken(refreshToken)]);
}

module.exports = { issueTokenPair, rotateRefreshToken, revokeAllForUser, revokeToken };
