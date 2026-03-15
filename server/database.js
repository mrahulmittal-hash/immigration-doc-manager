const { Pool } = require('pg');

// Connection pool — reads from environment variables
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'propgent',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // connection pool size
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// -------------------------------------------------------------------
// Schema bootstrap — run once on startup
// -------------------------------------------------------------------
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id              SERIAL PRIMARY KEY,
        first_name      TEXT NOT NULL,
        last_name       TEXT NOT NULL,
        email           TEXT,
        phone           TEXT,
        nationality     TEXT,
        date_of_birth   TEXT,
        passport_number TEXT,
        visa_type       TEXT,
        status          TEXT DEFAULT 'active',
        notes           TEXT,
        form_token      TEXT UNIQUE,
        pif_status      TEXT DEFAULT 'pending',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id            SERIAL PRIMARY KEY,
        client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        filename      TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path     TEXT NOT NULL,
        file_type     TEXT,
        file_size     BIGINT,
        category      TEXT,
        extracted_text TEXT,
        source        TEXT DEFAULT 'admin',
        uploaded_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS forms (
        id            SERIAL PRIMARY KEY,
        client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        filename      TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path     TEXT NOT NULL,
        form_name     TEXT,
        field_count   INTEGER DEFAULT 0,
        fields_json   TEXT,
        uploaded_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS client_data (
        id          SERIAL PRIMARY KEY,
        client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        field_key   TEXT NOT NULL,
        field_value TEXT,
        source      TEXT DEFAULT 'manual',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS filled_forms (
        id                SERIAL PRIMARY KEY,
        form_id           INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        file_path         TEXT NOT NULL,
        original_form_name TEXT,
        filled_at         TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pif_submissions (
        id           SERIAL PRIMARY KEY,
        client_id    INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
        form_data    TEXT NOT NULL,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Employee Management Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        email        TEXT NOT NULL UNIQUE,
        role         TEXT DEFAULT 'Case Manager',
        status       TEXT DEFAULT 'active',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_sessions (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type         TEXT NOT NULL, -- 'login' or 'logout'
        timestamp    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed default admin if none exists
    const adminExists = await client.query("SELECT id FROM users WHERE email = 'rajinder@propagent.ca'");
    if (adminExists.rowCount === 0) {
      await client.query(`
        INSERT INTO users (name, email, role, status) 
        VALUES ('Rajinder Anand', 'rajinder@propagent.ca', 'Admin', 'active')
      `);
    }

    // Seed sample users to match the current mock UI
    const sarahExists = await client.query("SELECT id FROM users WHERE email = 'sarah@propagent.ca'");
    if (sarahExists.rowCount === 0) {
      await client.query(`
        INSERT INTO users (name, email, role, status)
        VALUES 
        ('Sarah Kim', 'sarah@propagent.ca', 'Case Manager', 'active'),
        ('Priya Patel', 'priya@propagent.ca', 'Case Manager', 'active'),
        ('David Chen', 'david@propagent.ca', 'Viewer', 'inactive')
      `);
    }

    console.log('✅ PostgreSQL database initialized successfully');
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------------
// Async query helpers (drop-in replacements for sql.js helpers)
// -------------------------------------------------------------------

/**
 * Run a SELECT that returns multiple rows.
 * @param {string} sql  - SQL with $1, $2 … placeholders
 * @param  {...any} params
 * @returns {Promise<any[]>}
 */
async function prepareAll(sql, ...params) {
  try {
    const pgSql = toPgPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return result.rows;
  } catch (e) {
    console.error('SQL Error (all):', e.message, sql);
    return [];
  }
}

/**
 * Run a SELECT that returns at most one row.
 */
async function prepareGet(sql, ...params) {
  try {
    const pgSql = toPgPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return result.rows[0] || null;
  } catch (e) {
    console.error('SQL Error (get):', e.message, sql);
    return null;
  }
}

/**
 * Run an INSERT / UPDATE / DELETE.
 * Returns { lastInsertRowid, changes }.
 */
async function prepareRun(sql, ...params) {
  // Convert ? placeholders → $1, $2 …
  let pgSql = toPgPlaceholders(sql);

  // Append RETURNING id for INSERT statements so callers can get lastInsertRowid
  let isInsert = /^\s*INSERT/i.test(pgSql);
  if (isInsert && !/RETURNING/i.test(pgSql)) {
    pgSql += ' RETURNING id';
  }

  try {
    const result = await pool.query(pgSql, params);
    const lastInsertRowid = isInsert && result.rows[0] ? result.rows[0].id : null;
    const changes = result.rowCount;
    return { lastInsertRowid, changes };
  } catch (e) {
    console.error('SQL Error (run):', e.message, sql);
    throw e;
  }
}

/**
 * Convert SQLite-style ? placeholders to PostgreSQL $1, $2 … style.
 * Also normalises datetime('now') → NOW().
 */
function toPgPlaceholders(sql) {
  let i = 0;
  let result = sql.replace(/\?/g, () => `$${++i}`);
  // Normalise SQLite datetime functions
  result = result.replace(/datetime\(\s*['"]now['"]\s*\)/gi, 'NOW()');
  result = result.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');
  return result;
}

/** Expose the pool for advanced use (e.g., transactions) */
function getDb() {
  return pool;
}

module.exports = { initDatabase, getDb, prepareAll, prepareGet, prepareRun };
