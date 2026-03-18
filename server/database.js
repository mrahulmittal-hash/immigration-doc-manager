const { Pool } = require('pg');

// Connection pool — supports DATABASE_URL (Neon) or individual env vars
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 20 }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'propgent',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
    };
const pool = new Pool(poolConfig);

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
        id                    SERIAL PRIMARY KEY,
        name                  TEXT NOT NULL,
        email                 TEXT NOT NULL UNIQUE,
        password_hash         TEXT,
        role                  TEXT DEFAULT 'Case Manager',
        status                TEXT DEFAULT 'active',
        refresh_token         TEXT,
        refresh_token_expires TIMESTAMPTZ,
        created_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add columns if they don't exist (for existing DBs)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_expires TIMESTAMPTZ`);

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

    // IRCC Form Templates (uploaded PDFs for each form number)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ircc_form_templates (
        id              SERIAL PRIMARY KEY,
        form_number     TEXT NOT NULL UNIQUE,
        form_name       TEXT,
        visa_type       TEXT,
        file_path       TEXT NOT NULL,
        file_size       BIGINT,
        uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
        notes           TEXT
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

    // Email Ingestion Config (IMAP multi-provider)
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_ingestion_config (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
        provider          TEXT NOT NULL,
        imap_host         TEXT NOT NULL,
        imap_port         INTEGER NOT NULL DEFAULT 993,
        imap_tls          BOOLEAN DEFAULT TRUE,
        email_address     TEXT NOT NULL,
        app_password_enc  TEXT NOT NULL,
        app_password_iv   TEXT NOT NULL,
        app_password_tag  TEXT NOT NULL,
        sync_frequency    TEXT DEFAULT 'manual',
        last_sync_at      TIMESTAMPTZ,
        last_sync_status  TEXT,
        last_sync_error   TEXT,
        is_active         BOOLEAN DEFAULT TRUE,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_emails (
        id                SERIAL PRIMARY KEY,
        config_id         INTEGER NOT NULL REFERENCES email_ingestion_config(id) ON DELETE CASCADE,
        message_uid       TEXT NOT NULL,
        message_id        TEXT,
        client_id         INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        from_email        TEXT,
        subject           TEXT,
        received_at       TIMESTAMPTZ,
        attachments_count INTEGER DEFAULT 0,
        processed_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(config_id, message_uid)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_processed_emails_msguid ON processed_emails(config_id, message_uid)`);

    // Seed default admin if none exists (required for first login)
    const bcrypt = require('bcryptjs');
    const adminExists = await client.query("SELECT id FROM users LIMIT 1");
    if (adminExists.rowCount === 0) {
      const defaultHash = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, status)
        VALUES ('Admin', 'admin@propagent.ca', $1, 'Admin', 'active')
      `, [defaultHash]);
      console.log('✅ Created default admin user (admin@propagent.ca / admin123)');
    }

    // Seed document checklists (reference data for visa types)
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

    // ── IRCC Form Templates ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ircc_form_templates (
        id              SERIAL PRIMARY KEY,
        form_number     TEXT NOT NULL UNIQUE,
        form_name       TEXT,
        visa_type       TEXT,
        file_path       TEXT NOT NULL,
        file_size       BIGINT,
        uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
        notes           TEXT
      )
    `);

    // ── Audit Logs ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          SERIAL PRIMARY KEY,
        client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        entity_type TEXT NOT NULL,
        entity_id   INTEGER,
        action      TEXT NOT NULL,
        field_key   TEXT,
        old_value   TEXT,
        new_value   TEXT,
        changed_by  INTEGER REFERENCES users(id),
        changed_at  TIMESTAMPTZ DEFAULT NOW(),
        ip_address  TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_logs(client_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`);

    // ── PIF Field Verifications ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pif_field_verifications (
        id          SERIAL PRIMARY KEY,
        client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        field_key   TEXT NOT NULL,
        verified    BOOLEAN DEFAULT FALSE,
        comment     TEXT,
        verified_by INTEGER REFERENCES users(id),
        verified_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(client_id, field_key)
      )
    `);

    // ── PIF Re-verification Requests ─────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pif_reverification_requests (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        changed_fields  JSONB NOT NULL,
        changed_by      INTEGER REFERENCES users(id),
        status          TEXT DEFAULT 'pending',
        consent_given   BOOLEAN DEFAULT FALSE,
        consent_at      TIMESTAMPTZ,
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        responded_at    TIMESTAMPTZ
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


    // ── Service Fees ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_fees (
        id           SERIAL PRIMARY KEY,
        service_name TEXT NOT NULL UNIQUE,
        base_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
        gst_rate     NUMERIC(5,2) NOT NULL DEFAULT 5.00,
        description  TEXT,
        is_active    BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const sfExists = await client.query("SELECT COUNT(*) as cnt FROM service_fees");
    if (parseInt(sfExists.rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO service_fees (service_name, base_fee, gst_rate, description) VALUES
        ('Permanent Residence - Express Entry', 3500.00, 5.00, 'Federal Skilled Worker, CEC, or Federal Skilled Trades'),
        ('Permanent Residence - PNP', 2500.00, 5.00, 'Provincial Nominee Program application'),
        ('Study Permit', 1500.00, 5.00, 'Study permit for international students'),
        ('Work Permit (PGWP)', 1200.00, 5.00, 'Post-Graduation Work Permit'),
        ('Work Permit (LMIA-based)', 2000.00, 5.00, 'LMIA-based closed work permit'),
        ('Open Work Permit', 1500.00, 5.00, 'Open work permit (Bridging, Spousal, etc.)'),
        ('LMIA Application', 2500.00, 5.00, 'Labour Market Impact Assessment for employers'),
        ('Spousal Sponsorship', 3000.00, 5.00, 'Family class spousal or partner sponsorship'),
        ('Parent & Grandparent Sponsorship', 3500.00, 5.00, 'Family class parent/grandparent sponsorship'),
        ('Visitor Visa (TRV)', 1000.00, 5.00, 'Temporary Resident Visa for visitors'),
        ('Super Visa', 1200.00, 5.00, 'Super Visa for parents and grandparents'),
        ('Citizenship Application', 1000.00, 5.00, 'Canadian citizenship application'),
        ('PR Card Renewal', 800.00, 5.00, 'Permanent Resident card renewal'),
        ('Status Extension or Restoration', 800.00, 5.00, 'Extend or restore existing visa or permit'),
        ('Atlantic Immigration Program (AIP)', 3000.00, 5.00, 'Atlantic Immigration Program application'),
        ('IEC (Working Holiday)', 1000.00, 5.00, 'International Experience Canada — Working Holiday, Young Professional, Co-op'),
        ('eTA', 300.00, 5.00, 'Electronic Travel Authorization'),
        ('Humanitarian & Compassionate', 4000.00, 5.00, 'H&C grounds application'),
        ('Refugee Claim', 5000.00, 5.00, 'Refugee protection claim'),
        ('Other', 0.00, 5.00, 'Custom service — set fee manually')
      `);
      console.log('✅ Seeded service fees');
    }

    // ── Firm Profile ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS firm_profile (
        id             SERIAL PRIMARY KEY,
        rcic_name      TEXT DEFAULT '',
        rcic_license   TEXT DEFAULT '',
        business_name  TEXT DEFAULT '',
        address        TEXT DEFAULT '',
        city           TEXT DEFAULT '',
        province       TEXT DEFAULT '',
        postal_code    TEXT DEFAULT '',
        phone          TEXT DEFAULT '',
        email          TEXT DEFAULT '',
        logo_path      TEXT,
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO firm_profile (id) VALUES (1) ON CONFLICT DO NOTHING
    `);

    // ── Retainer Template Sections ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS retainer_template_sections (
        id             SERIAL PRIMARY KEY,
        section_number INTEGER NOT NULL UNIQUE,
        title          TEXT NOT NULL,
        content        TEXT NOT NULL,
        is_editable    BOOLEAN DEFAULT TRUE,
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const rtsExists = await client.query("SELECT COUNT(*) as cnt FROM retainer_template_sections");
    if (parseInt(rtsExists.rows[0].cnt) === 0) {
      const templateSections = [
        [1, 'Purpose and Interpretation', 'This is a formal retainer agreement that defines the contractual relationship between the RCIC and the Client. It outlines the immigration consulting services to be provided, the responsibilities of each party, the professional fees to be charged, and the client\'s rights, in compliance with the CICC\'s Code of Professional Conduct and applicable Canadian law.'],
        [2, 'Authorized Scope of Services', 'The RCIC agrees to provide immigration consulting and representation services related to:\n\n{{service_type}}'],
        [3, 'Responsibilities of the RCIC', 'The RCIC shall:\n- Provide honest, competent, and professional immigration advice and representation\n- Assess the Client\'s eligibility for the immigration service sought\n- Explain the process, documents required, deadlines, and anticipated timelines\n- Prepare, review, and submit relevant immigration forms and supporting documents to IRCC or other authorities\n- Communicate with IRCC and relevant agencies on the Client\'s behalf (if authorized)\n- Maintain confidentiality and act in the best interest of the Client\n- Keep the Client reasonably informed of progress\n- Provide a final copy of submitted application and IRCC correspondence'],
        [4, 'Responsibilities of the Client', 'The Client agrees to:\n- Provide full, accurate, and truthful information and documentation in a timely manner\n- Disclose any previous visa refusals, criminal history, misrepresentations, or immigration violations\n- Respond promptly to RCIC\'s communications\n- Pay all fees and costs as outlined in this Agreement\n- Understand that the RCIC cannot guarantee the outcome of the application\n- Inform the RCIC of any change in circumstances or contact details during the process'],
        [5, 'Fees and Payment Structure', 'Professional Fee: CAD ${{professional_fee}}\nGST ({{gst_rate}}%): CAD ${{gst_amount}}\nTotal: CAD ${{total_fee}}\n\n{{fee_adjustments}}\n\nDoes not include disbursements, government processing fees, courier charges, translation fees, or other third-party costs.\n\nAll funds deposited into a Client Account in accordance with Section 43 of the Code of Professional Conduct. Funds withdrawn only upon reaching milestones or delivering specific work as agreed.'],
        [6, 'Refund Policy', 'Refunds provided for unearned portion of fees upon termination before completion of services. Disbursements or third-party fees already paid are non-refundable. No refund if services fully rendered or if application refused by IRCC, unless refusal resulted from RCIC negligence or misconduct.'],
        [7, 'Client File and Record Retention', 'The RCIC retains Client records for 6 years from date of file closure, in compliance with CICC regulations. After 6 years, the RCIC may securely destroy records. The Client may request a copy of the file at any time within the retention period.'],
        [8, 'Confidentiality and Privacy', 'The RCIC maintains confidentiality of all Client information unless authorized by the Client or required by law. All records and personal data handled in accordance with PIPEDA and the CICC Code of Professional Conduct.'],
        [9, 'Use of Third Parties and Authorized Agents', 'The RCIC may engage another RCIC or qualified individual to assist, provided such person is disclosed to the Client and only with the Client\'s prior written consent.'],
        [10, 'Termination of Agreement', 'This agreement may be terminated:\n- By the Client at any time in writing\n- By the RCIC with written notice if the Client fails to cooperate, provides false documents, fails to pay, or breaches this agreement\n- Automatically upon completion of services\n\nUpon termination, the RCIC provides a final invoice and refunds unearned fees. The Client remains responsible for services rendered and disbursements to date of termination.'],
        [11, 'Dispute Resolution', 'The parties agree to attempt amicable resolution through discussion. If unresolved, the Client may file a complaint with the College of Immigration and Citizenship Consultants (CICC).'],
        [12, 'Acknowledgments by the Client', 'By signing, the Client acknowledges that they have:\n- Read, understood, and agreed to all terms in this Agreement\n- Received and reviewed the Client Service Agreement Disclosure Form (Schedule A)\n- Understood that the RCIC is licensed by CICC and must comply with all regulations and Code of Professional Conduct\n- Understood that no outcome is guaranteed and all decisions rest with IRCC or other authorities'],
        [13, 'Governing Law', 'This Agreement shall be governed by the laws of the Province of {{province}} and the federal laws of Canada applicable therein.'],
        [14, 'Entire Agreement', 'This Agreement constitutes the entire understanding between the parties and supersedes all prior agreements, oral or written. Any amendments must be in writing and signed by both parties.'],
      ];
      for (const [num, title, content] of templateSections) {
        await client.query(
          'INSERT INTO retainer_template_sections (section_number, title, content) VALUES ($1, $2, $3)',
          [num, title, content]
        );
      }
      console.log('✅ Seeded retainer template sections');
    }

    // ── Fee Adjustments ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_adjustments (
        id           SERIAL PRIMARY KEY,
        retainer_id  INTEGER REFERENCES retainers(id) ON DELETE CASCADE,
        client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        type         TEXT NOT NULL,
        amount       NUMERIC(10,2) DEFAULT 0,
        percentage   NUMERIC(5,2) DEFAULT 0,
        description  TEXT,
        created_by   INTEGER REFERENCES users(id),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Client Retainer Agreements ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_retainer_agreements (
        id             SERIAL PRIMARY KEY,
        client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        retainer_id    INTEGER REFERENCES retainers(id) ON DELETE SET NULL,
        generated_html TEXT NOT NULL,
        status         TEXT DEFAULT 'draft',
        generated_at   TIMESTAMPTZ DEFAULT NOW(),
        signed_at      TIMESTAMPTZ,
        docusign_envelope_id TEXT,
        signing_provider     TEXT DEFAULT 'builtin',
        sent_for_signing_at  TIMESTAMPTZ
      )
    `);

    // ── Signing Settings ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS signing_settings (
        id                       SERIAL PRIMARY KEY,
        provider                 TEXT DEFAULT 'docusign',
        docusign_account_id      TEXT DEFAULT '',
        docusign_integration_key TEXT DEFAULT '',
        docusign_secret          TEXT DEFAULT '',
        docusign_base_url        TEXT DEFAULT 'https://demo.docusign.net/restapi',
        docusign_oauth_url       TEXT DEFAULT 'https://account-d.docusign.com',
        docusign_access_token    TEXT,
        docusign_refresh_token   TEXT,
        docusign_token_expires   TIMESTAMPTZ,
        updated_at               TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`INSERT INTO signing_settings (id) VALUES (1) ON CONFLICT DO NOTHING`);

    // Add DocuSign columns to existing tables if missing
    await client.query(`ALTER TABLE signatures ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT`);
    await client.query(`ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signing_provider TEXT DEFAULT 'builtin'`);
    // Add DocuSign columns to client_retainer_agreements if they don't exist (for existing DBs)
    await client.query(`ALTER TABLE client_retainer_agreements ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT`).catch(() => {});
    await client.query(`ALTER TABLE client_retainer_agreements ADD COLUMN IF NOT EXISTS signing_provider TEXT DEFAULT 'builtin'`).catch(() => {});
    await client.query(`ALTER TABLE client_retainer_agreements ADD COLUMN IF NOT EXISTS sent_for_signing_at TIMESTAMPTZ`).catch(() => {});

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
