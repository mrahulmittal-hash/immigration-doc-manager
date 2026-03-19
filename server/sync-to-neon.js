/**
 * Sync local PostgreSQL data → Neon
 * Clears Neon tables and copies all rows from local DB.
 */
const { Pool } = require('pg');

const local = new Pool({ host: 'localhost', port: 5432, database: 'propgent', user: 'postgres', password: 'postgres' });
const neon = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_N4qx2peVgyCv@ep-blue-scene-admt9eyo-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Tables in dependency order (parents before children)
const TABLES = [
  'users',
  'clients',
  'dependents',
  'documents',
  'forms',
  'filled_forms',
  'client_data',
  'client_timeline',
  'client_notes',
  'client_deadlines',
  'pif_submissions',
  'pif_field_verifications',
  'pif_reverification_requests',
  'signatures',
  'trust_accounts',
  'invoices',
  'transactions',
  'employers',
  'employer_clients',
  'employer_fees',
  'lmia_applications',
  'job_bank_ads',
  'retainers',
  'payments',
  'fee_adjustments',
  'client_retainer_agreements',
  'tasks',
  'employee_sessions',
  'audit_logs',
  'ircc_updates',
  'ircc_form_templates',
  'document_checklists',
  'client_checklist_status',
  'email_settings',
  'client_emails',
  'email_ingestion_config',
  'processed_emails',
  'immigration_photos',
  'milestone_releases',
  'operating_accounts',
  'service_fees',
  'firm_profile',
  'retainer_template_sections',
  'signing_settings',
];

async function syncTable(table) {
  try {
    // Check if table exists in local
    const localCheck = await local.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
      [table]
    );
    if (!localCheck.rows[0].exists) {
      console.log(`  ⏭  ${table} — not in local, skipping`);
      return;
    }

    // Get local rows
    const localRows = await local.query(`SELECT * FROM ${table}`);
    const count = localRows.rows.length;
    if (count === 0) {
      console.log(`  ⏭  ${table} — 0 rows, skipping`);
      return;
    }

    // Insert rows
    const columns = Object.keys(localRows.rows[0]);
    const colList = columns.map(c => `"${c}"`).join(', ');

    let inserted = 0;
    for (const row of localRows.rows) {
      const values = columns.map(c => row[c]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      try {
        await neon.query(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`, values);
        inserted++;
      } catch (e) {
        // Skip duplicate/constraint errors silently
        if (!e.message.includes('duplicate') && !e.message.includes('violates')) {
          console.error(`    Error inserting into ${table}: ${e.message}`);
        }
      }
    }
    console.log(`  ✅ ${table}: ${inserted}/${count} rows synced`);

    // Reset sequence to max id
    try {
      await neon.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
    } catch (e) {
      // Table may not have an 'id' serial column
    }
  } catch (e) {
    console.error(`  ❌ ${table}: ${e.message}`);
  }
}

async function main() {
  console.log('Starting local → Neon sync...\n');

  // Clear all tables in reverse order (children first) to respect FK constraints
  console.log('Clearing Neon tables...');
  for (const table of [...TABLES].reverse()) {
    try {
      await neon.query(`DELETE FROM ${table}`);
    } catch (e) { /* table may not exist */ }
  }
  console.log('Cleared.\n');

  for (const table of TABLES) {
    await syncTable(table);
  }

  console.log('\nSync complete!');
  await local.end();
  await neon.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
