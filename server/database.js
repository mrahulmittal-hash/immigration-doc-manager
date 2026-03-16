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

    // Client Timeline
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_timeline (
        id          SERIAL PRIMARY KEY,
        client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        event_type  TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        metadata    JSONB,
        created_by  TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Client Notes
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_notes (
        id         SERIAL PRIMARY KEY,
        client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        content    TEXT NOT NULL,
        author     TEXT DEFAULT 'Admin',
        is_pinned  BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // IRCC Updates
    await client.query(`
      CREATE TABLE IF NOT EXISTS ircc_updates (
        id              SERIAL PRIMARY KEY,
        title           TEXT NOT NULL,
        url             TEXT UNIQUE,
        summary         TEXT,
        category        TEXT,
        published_date  TEXT,
        scraped_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Client Deadlines
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_deadlines (
        id             SERIAL PRIMARY KEY,
        client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        title          TEXT NOT NULL,
        deadline_date  DATE NOT NULL,
        category       TEXT DEFAULT 'general',
        status         TEXT DEFAULT 'pending',
        reminder_days  INTEGER DEFAULT 7,
        notes          TEXT,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Document Checklists
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_checklists (
        id             SERIAL PRIMARY KEY,
        visa_type      TEXT NOT NULL,
        document_name  TEXT NOT NULL,
        is_required    BOOLEAN DEFAULT TRUE,
        description    TEXT,
        category       TEXT DEFAULT 'general'
      )
    `);

    // Client Checklist Status
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_checklist_status (
        id             SERIAL PRIMARY KEY,
        client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        checklist_id   INTEGER NOT NULL REFERENCES document_checklists(id) ON DELETE CASCADE,
        status         TEXT DEFAULT 'missing',
        document_id    INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        notes          TEXT
      )
    `);

    // Add pipeline_stage column to clients
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'lead'`);

    // Add data_map_json to filled_forms for form editor support
    await client.query(`ALTER TABLE filled_forms ADD COLUMN IF NOT EXISTS data_map_json TEXT`);

    // E-Signatures
    await client.query(`
      CREATE TABLE IF NOT EXISTS signatures (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        document_type   TEXT NOT NULL,
        document_name   TEXT,
        signature_image TEXT,
        signed_at       TIMESTAMPTZ,
        status          TEXT DEFAULT 'pending',
        sign_token      TEXT UNIQUE,
        token_expires   TIMESTAMPTZ,
        filled_form_id  INTEGER REFERENCES filled_forms(id) ON DELETE SET NULL,
        signed_pdf_path TEXT,
        ip_address      TEXT,
        user_agent      TEXT,
        requested_by    TEXT DEFAULT 'Admin',
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Trust Accounting
    await client.query(`
      CREATE TABLE IF NOT EXISTS trust_accounts (
        id          SERIAL PRIMARY KEY,
        client_id   INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
        balance     DECIMAL(12,2) DEFAULT 0.00,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        invoice_number  TEXT NOT NULL UNIQUE,
        description     TEXT,
        amount          DECIMAL(12,2) NOT NULL,
        status          TEXT DEFAULT 'draft',
        due_date        DATE,
        paid_date       DATE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id               SERIAL PRIMARY KEY,
        client_id        INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        invoice_id       INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
        type             TEXT NOT NULL,
        amount           DECIMAL(12,2) NOT NULL,
        description      TEXT,
        reference_number TEXT,
        pipeline_stage   TEXT,
        created_by       TEXT DEFAULT 'Admin',
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS milestone_releases (
        id             SERIAL PRIMARY KEY,
        client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        pipeline_stage TEXT NOT NULL,
        amount         DECIMAL(12,2) NOT NULL,
        percentage     DECIMAL(5,2),
        status         TEXT DEFAULT 'pending',
        released_at    TIMESTAMPTZ,
        transaction_id INTEGER REFERENCES transactions(id),
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS operating_accounts (
        id          SERIAL PRIMARY KEY,
        balance     DECIMAL(12,2) DEFAULT 0.00,
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed single operating account row
    await client.query(`
      INSERT INTO operating_accounts (id, balance) VALUES (1, 0.00)
      ON CONFLICT DO NOTHING
    `);

    // Tasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id           SERIAL PRIMARY KEY,
        client_id    INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        title        TEXT NOT NULL,
        priority     TEXT DEFAULT 'medium',
        category     TEXT DEFAULT 'Other',
        due_date     DATE,
        done         BOOLEAN DEFAULT FALSE,
        created_by   TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    // Email Integration
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        access_token    TEXT,
        refresh_token   TEXT,
        token_expires_at TIMESTAMPTZ,
        email_address   TEXT,
        is_connected    BOOLEAN DEFAULT FALSE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS client_emails (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        message_id      TEXT UNIQUE,
        from_email      TEXT,
        from_name       TEXT,
        subject         TEXT,
        body_preview    TEXT,
        received_at     TIMESTAMPTZ,
        has_attachments BOOLEAN DEFAULT FALSE,
        folder          TEXT DEFAULT 'inbox'
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

    // Seed sample clients for demo purposes
    const clientsExist = await client.query("SELECT COUNT(*) as cnt FROM clients");
    if (parseInt(clientsExist.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO clients (first_name, last_name, email, phone, nationality, date_of_birth, passport_number, visa_type, status, pif_status, form_token, notes, created_at)
        VALUES
        ('Anish', 'Sharma', 'anish.sharma@gmail.com', '+1 (604) 555-0112', 'Indian', '1992-06-15', 'K8234567', 'Express Entry', 'active', 'completed', 'tok_anish01', 'CRS score 478. IELTS 7.5 overall. 3 years Canadian work experience as Software Engineer.', NOW() - INTERVAL '45 days'),
        ('Wei', 'Chen', 'wei.chen@outlook.com', '+1 (416) 555-0198', 'Chinese', '1998-11-03', 'E12345678', 'Study Permit', 'active', 'sent', 'tok_wei02', 'Accepted to UBC Computer Science. GIC completed. Tuition paid for first year.', NOW() - INTERVAL '30 days'),
        ('Phuong', 'Nguyen', 'phuong.n@yahoo.com', '+1 (587) 555-0234', 'Vietnamese', '1988-03-22', 'B7654321', 'Spousal Sponsorship', 'active', 'pending', 'tok_phuong03', 'Spouse is Canadian citizen. Married 2 years. Joint bank accounts and lease provided.', NOW() - INTERVAL '20 days'),
        ('Raj', 'Patel', 'raj.patel@hotmail.com', '+1 (403) 555-0167', 'Indian', '1995-09-10', 'M4567890', 'Work Permit (PGWP)', 'active', 'completed', 'tok_raj04', 'Graduated from Conestoga College. Diploma in Business Management. Applied within 180 days.', NOW() - INTERVAL '60 days'),
        ('Maria', 'Garcia', 'maria.garcia@gmail.com', '+1 (778) 555-0145', 'Mexican', '1990-12-01', 'G9876543', 'PR Application', 'active', 'sent', 'tok_maria05', 'Provincial Nominee Program — BC PNP Tech. Currently on work permit expiring Dec 2026.', NOW() - INTERVAL '15 days'),
        ('Oleksandr', 'Kovalenko', 'oleks.koval@gmail.com', '+1 (647) 555-0289', 'Ukrainian', '1985-07-18', 'FA234567', 'Express Entry', 'active', 'completed', 'tok_oleks06', 'CUAET pathway. Currently working as Electrician. NOC 72200. CLB 8.', NOW() - INTERVAL '90 days'),
        ('Fatima', 'Al-Hassan', 'fatima.alh@outlook.com', '+1 (905) 555-0321', 'Syrian', '1993-04-25', 'N1122334', 'Refugee Claim', 'active', 'pending', 'tok_fatima07', 'Referred by UNHCR. Family of 4. Awaiting hearing date from IRB.', NOW() - INTERVAL '10 days'),
        ('James', 'O''Brien', 'james.obrien@icloud.com', '+1 (236) 555-0456', 'Irish', '1991-01-30', 'PA5566778', 'Work Permit (LMIA)', 'inactive', 'completed', 'tok_james08', 'LMIA approved for Restaurant Manager position. Employer: West Coast Dining Inc. Case closed — permit issued.', NOW() - INTERVAL '120 days')
      `);

      // Add some client_data entries for clients with completed PIFs
      const anishId = (await client.query("SELECT id FROM clients WHERE email = 'anish.sharma@gmail.com'")).rows[0]?.id;
      const rajId = (await client.query("SELECT id FROM clients WHERE email = 'raj.patel@hotmail.com'")).rows[0]?.id;
      const oleksId = (await client.query("SELECT id FROM clients WHERE email = 'oleks.koval@gmail.com'")).rows[0]?.id;

      if (anishId) {
        await client.query(`
          INSERT INTO client_data (client_id, field_key, field_value) VALUES
          ($1, 'CRS Score', '478'),
          ($1, 'IELTS Overall', '7.5'),
          ($1, 'Work Experience (Years)', '3'),
          ($1, 'Employer', 'TechNova Solutions Inc.'),
          ($1, 'NOC Code', '21232')
        `, [anishId]);
      }
      if (rajId) {
        await client.query(`
          INSERT INTO client_data (client_id, field_key, field_value) VALUES
          ($1, 'Institution', 'Conestoga College'),
          ($1, 'Program', 'Business Management'),
          ($1, 'Graduation Date', '2025-12-15'),
          ($1, 'Student Permit Expiry', '2026-06-15')
        `, [rajId]);
      }
      if (oleksId) {
        await client.query(`
          INSERT INTO client_data (client_id, field_key, field_value) VALUES
          ($1, 'CRS Score', '462'),
          ($1, 'CLB Level', '8'),
          ($1, 'Trade Certification', 'Red Seal Electrician'),
          ($1, 'CUAET Status', 'Approved')
        `, [oleksId]);
      }

      console.log('✅ Seeded 8 sample clients with data');
    }

    const checklistExists = await client.query("SELECT COUNT(*) as cnt FROM document_checklists");
    if (parseInt(checklistExists.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO document_checklists (visa_type, document_name, is_required, description, category) VALUES
        ('Express Entry', 'Valid Passport', true, 'Current passport with at least 6 months validity', 'identity'),
        ('Express Entry', 'Language Test Results (IELTS/CELPIP)', true, 'Must be less than 2 years old', 'language'),
        ('Express Entry', 'Education Credential Assessment (ECA)', true, 'WES or equivalent assessment', 'education'),
        ('Express Entry', 'Work Experience Letters', true, 'Reference letters from employers detailing duties', 'employment'),
        ('Express Entry', 'Police Clearance Certificate', true, 'From each country lived in 6+ months', 'background'),
        ('Express Entry', 'Medical Exam Results', true, 'From IRCC panel physician', 'medical'),
        ('Express Entry', 'Proof of Funds', true, 'Bank statements showing settlement funds', 'financial'),
        ('Express Entry', 'Digital Photo', true, 'IRCC specification photo', 'identity'),
        ('Express Entry', 'Provincial Nomination (if applicable)', false, 'PNP certificate if applicable', 'other'),
        ('Study Permit', 'Valid Passport', true, 'Current passport', 'identity'),
        ('Study Permit', 'Letter of Acceptance', true, 'From designated learning institution (DLI)', 'education'),
        ('Study Permit', 'Proof of Financial Support', true, 'Tuition + living expenses evidence', 'financial'),
        ('Study Permit', 'GIC Certificate', false, 'Guaranteed Investment Certificate', 'financial'),
        ('Study Permit', 'Language Test Results', true, 'IELTS or equivalent', 'language'),
        ('Study Permit', 'Statement of Purpose', true, 'Letter explaining study plans', 'other'),
        ('Work Permit (PGWP)', 'Valid Passport', true, 'Current passport', 'identity'),
        ('Work Permit (PGWP)', 'Official Transcript', true, 'From Canadian institution', 'education'),
        ('Work Permit (PGWP)', 'Completion Letter', true, 'Letter confirming program completion', 'education'),
        ('Work Permit (PGWP)', 'Valid Study Permit', true, 'Current or expired study permit', 'identity'),
        ('Work Permit (PGWP)', 'Digital Photo', true, 'IRCC specification photo', 'identity'),
        ('Spousal Sponsorship', 'Valid Passport', true, 'Current passport for both parties', 'identity'),
        ('Spousal Sponsorship', 'Marriage Certificate', true, 'Official marriage certificate', 'identity'),
        ('Spousal Sponsorship', 'Proof of Relationship', true, 'Photos, communication records, joint accounts', 'relationship'),
        ('Spousal Sponsorship', 'Sponsor Income Documents', true, 'T4, NOA, employment letter', 'financial'),
        ('Spousal Sponsorship', 'Police Clearance Certificate', true, 'From each country lived 6+ months', 'background'),
        ('Spousal Sponsorship', 'Medical Exam Results', true, 'From IRCC panel physician', 'medical'),
        ('Spousal Sponsorship', 'IMM 1344 Sponsorship Agreement', true, 'Signed undertaking form', 'forms')
      `);
      console.log('✅ Seeded document checklists');
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
