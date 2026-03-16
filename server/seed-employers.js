require('dotenv').config();
const { prepareRun, prepareGet, prepareAll } = require('./database');

async function seed() {
  const lmias = await prepareAll('SELECT * FROM lmia_applications');
  if (lmias.length > 0) { console.log('LMIA data already exists, skipping'); return; }

  // Use first available client for LMIA demo
  const client = await prepareGet("SELECT id FROM clients ORDER BY id LIMIT 1");
  const wc = await prepareGet("SELECT id FROM employers WHERE company_name = 'West Coast Dining Inc.'");
  const tn = await prepareGet("SELECT id FROM employers WHERE company_name = 'TechNova Solutions Inc.'");
  if (!client || !wc) { console.log('Missing client or employer data'); return; }

  // Seed LMIA for West Coast Dining
  const r = await prepareRun(
    "INSERT INTO lmia_applications (employer_id, client_id, job_title, noc_code, teer_category, wage_offered, wage_type, work_location, stream, status, lmia_number, submission_date, decision_date, expiry_date, notes) VALUES (?, ?, 'Restaurant Manager', '60030', 'TEER 0', 28.50, 'hourly', 'Vancouver, BC', 'high_wage', 'approved', 'M1234567', '2025-08-15', '2025-10-01', '2026-04-01', 'LMIA approved — work permit issued')",
    wc.id, client.id
  );
  console.log('LMIA created:', r.lastInsertRowid);

  // Seed another LMIA in draft for TechNova
  if (tn) {
    await prepareRun(
      "INSERT INTO lmia_applications (employer_id, job_title, noc_code, teer_category, wage_offered, wage_type, work_location, stream, status, notes) VALUES (?, 'Software Developer', '21232', 'TEER 0', 45.00, 'hourly', 'Vancouver, BC', 'global_talent', 'draft', 'New LMIA for developer position')",
      tn.id
    );
    console.log('TechNova LMIA created');
  }

  // Link client to employer
  await prepareRun(
    "INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, status, lmia_id) VALUES (?, ?, 'Restaurant Manager', '2025-11-01', 28.50, 'hourly', 'active', ?)",
    wc.id, client.id, r.lastInsertRowid
  );
  console.log('Employer-client linked');

  // Seed job bank ad
  await prepareRun(
    "INSERT INTO job_bank_ads (lmia_id, employer_id, job_bank_id, job_title, noc_code, posting_date, expiry_date, posting_url, status, additional_ads) VALUES (?, ?, 'JB-2025-4567890', 'Restaurant Manager', '60030', '2025-07-01', '2025-08-01', 'https://www.jobbank.gc.ca/jobsearch/jobposting/4567890', 'completed', '[]')",
    r.lastInsertRowid, wc.id
  );
  console.log('Job ad seeded');

  // Seed retainers for first two clients
  const clients = await prepareAll("SELECT id FROM clients ORDER BY id LIMIT 2");
  if (clients[0]) {
    await prepareRun("INSERT INTO retainers (client_id, service_type, retainer_fee, amount_paid, status, due_date, signed_date) VALUES (?, 'Express Entry Application', 5000.00, 5000.00, 'paid', '2025-12-01', '2025-10-15')", clients[0].id);
    console.log('Retainer 1 seeded');
  }
  if (clients[1]) {
    await prepareRun("INSERT INTO retainers (client_id, service_type, retainer_fee, amount_paid, status, due_date, signed_date) VALUES (?, 'Study Permit Application', 3500.00, 1500.00, 'partial', '2026-04-01', '2026-01-10')", clients[1].id);
    console.log('Retainer 2 seeded');
  }

  // Seed employer fees
  await prepareRun("INSERT INTO employer_fees (employer_id, description, amount, status, invoice_date, due_date) VALUES (?, 'LMIA Application Preparation — Restaurant Manager', 2500.00, 'paid', '2025-08-01', '2025-09-01')", wc.id);
  if (tn) {
    await prepareRun("INSERT INTO employer_fees (employer_id, description, amount, status, invoice_date, due_date) VALUES (?, 'LMIA Application — Software Developer', 3000.00, 'unpaid', '2026-03-01', '2026-04-01')", tn.id);
  }
  console.log('Employer fees seeded');
  console.log('Done!');
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
