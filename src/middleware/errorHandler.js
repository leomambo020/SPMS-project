const env = require('../config/env');

// PostgreSQL error codes worth translating into clean client-facing messages.
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';
const PG_INSUFFICIENT_PRIVILEGE = '42501'; // e.g. blocked by an RLS policy

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.code === PG_UNIQUE_VIOLATION) {
    return res.status(409).json({ error: 'A record with those details already exists.' });
  }
  if (err.code === PG_FOREIGN_KEY_VIOLATION) {
    return res.status(409).json({ error: 'This action references a record that does not exist.' });
  }
  if (err.code === PG_CHECK_VIOLATION) {
    return res.status(400).json({ error: 'The submitted data violates a data constraint.' });
  }
  if (err.code === PG_INSUFFICIENT_PRIVILEGE) {
    return res.status(403).json({ error: 'You do not have permission to access this record.' });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  // Unexpected error: log full detail server-side, never leak it to the client.
  console.error('Unhandled error:', err);
  const body = { error: 'An unexpected error occurred.' };
  if (env.nodeEnv !== 'production') {
    body.debug = { message: err.message, stack: err.stack };
  }
  res.status(500).json(body);
}

module.exports = { notFoundHandler, errorHandler };
