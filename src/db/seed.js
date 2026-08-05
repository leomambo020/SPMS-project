/**
 * Bootstraps the very first HR admin account so someone can log in and
 * start creating real employees/departments/accounts through the API.
 *
 * Run once, using the schema-owning role (MIGRATIONS_DATABASE_URL /
 * DATABASE_URL as an owner connection), same as migrate.js — NOT the
 * low-privilege spms_app runtime role. Table owners are not subject to
 * RLS by default, which is exactly what lets this bootstrap insert
 * succeed with no session variables set.
 *
 * Usage:
 *   SEED_HR_USERNAME=admin SEED_HR_PASSWORD='ChangeMe123!' node src/db/seed.js
 */
const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const username = process.env.SEED_HR_USERNAME || 'admin';
  const password = process.env.SEED_HR_PASSWORD;

  if (!password || password.length < 10) {
    throw new Error('Set SEED_HR_PASSWORD (>= 10 characters) before running the seed script.');
  }

  const client = new Client({
    connectionString: process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM user_accounts WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      console.log(`User "${username}" already exists — nothing to do.`);
      return;
    }

    await client.query('BEGIN');

    const { rows: deptRows } = await client.query(
      `INSERT INTO departments (dept_name) VALUES ('Human Resources')
       ON CONFLICT (dept_name) DO UPDATE SET dept_name = EXCLUDED.dept_name
       RETURNING dept_id`
    );

    const { rows: empRows } = await client.query(
      `INSERT INTO employees (full_name, dept_id, job_title, contact_info)
       VALUES ('System Administrator', $1, 'HR Administrator', 'admin@example.com')
       RETURNING employee_id`,
      [deptRows[0].dept_id]
    );

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

    await client.query(
      `INSERT INTO user_accounts (employee_id, username, password_hash, role)
       VALUES ($1, $2, $3, 'hr_admin')`,
      [empRows[0].employee_id, username, passwordHash]
    );

    await client.query(
      'UPDATE departments SET supervisor_id = $1 WHERE dept_id = $2',
      [empRows[0].employee_id, deptRows[0].dept_id]
    );

    await client.query('COMMIT');
    console.log(`Bootstrap HR admin "${username}" created.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
