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

    // ── Employers ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS employers (
        id              SERIAL PRIMARY KEY,
        company_name    TEXT NOT NULL,
        trade_name      TEXT,
        business_number TEXT,
        contact_name    TEXT,
        contact_email   TEXT,
        contact_phone   TEXT,
        address         TEXT,
        city            TEXT,
        province        TEXT,
        postal_code     TEXT,
        industry        TEXT,
        num_employees   INTEGER,
        notes           TEXT,
        status          TEXT DEFAULT 'active',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Retainers ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS retainers (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        service_type    TEXT NOT NULL,
        retainer_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
        amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0,
        status          TEXT DEFAULT 'pending',
        due_date        DATE,
        signed_date     DATE,
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Payments ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id               SERIAL PRIMARY KEY,
        retainer_id      INTEGER NOT NULL REFERENCES retainers(id) ON DELETE CASCADE,
        client_id        INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        amount           NUMERIC(10,2) NOT NULL,
        payment_method   TEXT,
        payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
        reference_number TEXT,
        notes            TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── LMIA Applications ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS lmia_applications (
        id              SERIAL PRIMARY KEY,
        employer_id     INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
        client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        job_title       TEXT NOT NULL,
        noc_code        TEXT,
        teer_category   TEXT,
        wage_offered    NUMERIC(10,2),
        wage_type       TEXT DEFAULT 'hourly',
        work_location   TEXT,
        num_positions   INTEGER DEFAULT 1,
        lmia_number     TEXT,
        stream          TEXT DEFAULT 'high_wage',
        status          TEXT DEFAULT 'draft',
        submission_date DATE,
        decision_date   DATE,
        expiry_date     DATE,
        job_duties      TEXT,
        transition_plan TEXT,
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Job Bank Ads ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_bank_ads (
        id              SERIAL PRIMARY KEY,
        lmia_id         INTEGER NOT NULL REFERENCES lmia_applications(id) ON DELETE CASCADE,
        employer_id     INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
        job_bank_id     TEXT,
        job_title       TEXT NOT NULL,
        noc_code        TEXT,
        posting_date    DATE NOT NULL,
        expiry_date     DATE,
        posting_url     TEXT,
        status          TEXT DEFAULT 'active',
        min_weeks       INTEGER DEFAULT 4,
        additional_ads  JSONB DEFAULT '[]',
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Employer Fees ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS employer_fees (
        id              SERIAL PRIMARY KEY,
        employer_id     INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
        lmia_id         INTEGER REFERENCES lmia_applications(id) ON DELETE SET NULL,
        description     TEXT NOT NULL,
        amount          NUMERIC(10,2) NOT NULL,
        status          TEXT DEFAULT 'unpaid',
        invoice_date    DATE DEFAULT CURRENT_DATE,
        due_date        DATE,
        paid_date       DATE,
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Employer-Client Junction ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS employer_clients (
        id              SERIAL PRIMARY KEY,
        employer_id     INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        job_title       TEXT,
        start_date      DATE,
        wage            NUMERIC(10,2),
        wage_type       TEXT DEFAULT 'hourly',
        status          TEXT DEFAULT 'active',
        lmia_id         INTEGER REFERENCES lmia_applications(id) ON DELETE SET NULL,
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(employer_id, client_id)
      )
    `);

    // ── Dependents ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS dependents (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        first_name      TEXT NOT NULL,
        last_name       TEXT NOT NULL,
        relationship    TEXT NOT NULL,
        date_of_birth   TEXT,
        nationality     TEXT,
        passport_number TEXT,
        email           TEXT,
        phone           TEXT,
        gender          TEXT,
        marital_status  TEXT,
        photo_path      TEXT,
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Immigration Photos ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS immigration_photos (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        dependent_id    INTEGER REFERENCES dependents(id) ON DELETE CASCADE,
        person_name     TEXT NOT NULL,
        person_type     TEXT NOT NULL DEFAULT 'client',
        filename        TEXT NOT NULL,
        original_name   TEXT NOT NULL,
        file_path       TEXT NOT NULL,
        file_size       INTEGER,
        status          TEXT DEFAULT 'pending',
        notes           TEXT,
        uploaded_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed sample employers
    const empExists = await client.query("SELECT COUNT(*) as cnt FROM employers");
    if (parseInt(empExists.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO employers (company_name, trade_name, business_number, contact_name, contact_email, contact_phone, address, city, province, postal_code, industry, num_employees, status)
        VALUES
        ('TechNova Solutions Inc.', 'TechNova', '123456789RC0001', 'Michael Torres', 'michael@technova.ca', '+1 (604) 555-0500', '1200 West Georgia St, Suite 800', 'Vancouver', 'BC', 'V6E 4A2', 'Technology', 150, 'active'),
        ('West Coast Dining Inc.', 'West Coast Dining', '987654321RC0001', 'Patricia Wong', 'patricia@westcoastdining.ca', '+1 (604) 555-0600', '456 Robson St', 'Vancouver', 'BC', 'V6B 2B5', 'Food & Hospitality', 45, 'active')
      `);

      // Link James O'Brien to West Coast Dining with an LMIA
      const jamesId = (await client.query("SELECT id FROM clients WHERE email = 'james.obrien@icloud.com'")).rows[0]?.id;
      const wcId = (await client.query("SELECT id FROM employers WHERE company_name = 'West Coast Dining Inc.'")).rows[0]?.id;
      if (jamesId && wcId) {
        const lmiaResult = await client.query(`
          INSERT INTO lmia_applications (employer_id, client_id, job_title, noc_code, teer_category, wage_offered, wage_type, work_location, stream, status, lmia_number, submission_date, decision_date, expiry_date, notes)
          VALUES ($1, $2, 'Restaurant Manager', '60030', 'TEER 0', 28.50, 'hourly', 'Vancouver, BC', 'high_wage', 'approved', 'M1234567', '2025-08-15', '2025-10-01', '2026-04-01', 'LMIA approved — work permit issued')
          RETURNING id
        `, [wcId, jamesId]);
        const lmiaId = lmiaResult.rows[0].id;

        await client.query(`
          INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, status, lmia_id)
          VALUES ($1, $2, 'Restaurant Manager', '2025-11-01', 28.50, 'hourly', 'active', $3)
        `, [wcId, jamesId, lmiaId]);

        await client.query(`
          INSERT INTO job_bank_ads (lmia_id, employer_id, job_bank_id, job_title, noc_code, posting_date, expiry_date, posting_url, status, additional_ads)
          VALUES ($1, $2, 'JB-2025-4567890', 'Restaurant Manager', '60030', '2025-07-01', '2025-08-01', 'https://www.jobbank.gc.ca/jobsearch/jobposting/4567890', 'completed',
            '[{"platform":"Indeed","url":"https://indeed.com/job/12345","posting_date":"2025-07-01","expiry_date":"2025-08-01"}]')
        `, [lmiaId, wcId]);
      }

      // Seed sample retainers
      const anishRetId = (await client.query("SELECT id FROM clients WHERE email = 'anish.sharma@gmail.com'")).rows[0]?.id;
      const weiRetId = (await client.query("SELECT id FROM clients WHERE email = 'wei.chen@outlook.com'")).rows[0]?.id;
      if (anishRetId) {
        await client.query(`
          INSERT INTO retainers (client_id, service_type, retainer_fee, amount_paid, status, due_date, signed_date)
          VALUES ($1, 'Express Entry Application', 5000.00, 5000.00, 'paid', '2025-12-01', '2025-10-15')
        `, [anishRetId]);
      }
      if (weiRetId) {
        await client.query(`
          INSERT INTO retainers (client_id, service_type, retainer_fee, amount_paid, status, due_date, signed_date)
          VALUES ($1, 'Study Permit Application', 3500.00, 1500.00, 'partial', '2026-04-01', '2026-01-10')
        `, [weiRetId]);
      }

      // Seed employer fee
      if (wcId) {
        await client.query(`
          INSERT INTO employer_fees (employer_id, description, amount, status, invoice_date, due_date)
          VALUES ($1, 'LMIA Application Preparation — Restaurant Manager', 2500.00, 'paid', '2025-08-01', '2025-09-01')
        `, [wcId]);
      }

      console.log('✅ Seeded employers, LMIA, retainers, and fees');
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
