const { Pool } = require('pg');
const env = require('./env');

// This pool MUST connect using a low-privilege PostgreSQL role (see
// README.md "Database roles"). Every table with sensitive data has row
// level security enabled — the role behind DATABASE_URL is what makes
// that security boundary real. Do not point this at a superuser or
// table-owning role, and do not grant it BYPASSRLS.
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Errors on idle clients in the pool (e.g. connection dropped) — log
  // and let the pool recover; never crash the process on a query error.
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
