const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'propgent',
  user: 'postgres',
  password: 'postgres',
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── USERS (8) ──
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const users = [
      ['Rajinder Singh', 'admin@propagent.ca', hash('admin123'), 'Admin'],
      ['Sarah Kim', 'sarah@propagent.ca', hash('password123'), 'RCIC Consultant'],
      ['Priya Patel', 'priya@propagent.ca', hash('password123'), 'Case Manager'],
      ['David Chen', 'david@propagent.ca', hash('password123'), 'Case Manager'],
      ['Amira Hassan', 'amira@propagent.ca', hash('password123'), 'RCIC Consultant'],
      ['Jason Lee', 'jason@propagent.ca', hash('password123'), 'Case Manager'],
      ['Maria Garcia', 'maria@propagent.ca', hash('password123'), 'Staff'],
      ['Tom Wilson', 'tom@propagent.ca', hash('password123'), 'Staff'],
    ];
    const userIds = [];
    for (const [name, email, pw, role] of users) {
      const r = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET name=$1, password_hash=$3, role=$4 RETURNING id`,
        [name, email, pw, role]
      );
      userIds.push(r.rows[0].id);
    }
    console.log('✅ Users seeded:', userIds.length);

    // ── CLIENTS (8) ──
    const clients = [
      ['Arjun', 'Mehta', 'arjun.mehta@gmail.com', '647-555-1001', 'Indian', '1990-03-15', 'L1234567', 'Work Permit', 'active', 'consultation', 'LMIA-based work permit applicant'],
      ['Wei', 'Zhang', 'wei.zhang@outlook.com', '604-555-2002', 'Chinese', '1988-07-22', 'G87654321', 'Study Permit', 'active', 'document_collection', 'PhD student applying for study permit extension'],
      ['Fatima', 'Al-Rashid', 'fatima.r@yahoo.com', '416-555-3003', 'Iraqi', '1995-11-08', 'A99887766', 'Express Entry', 'active', 'pif_submitted', 'CRS score 478 — FSW category'],
      ['Carlos', 'Rivera', 'c.rivera@hotmail.com', '514-555-4004', 'Mexican', '1992-01-30', 'MEX5544332', 'PNP', 'active', 'under_review', 'Ontario PNP — Employer Job Offer stream'],
      ['Olena', 'Kovalenko', 'olena.k@gmail.com', '403-555-5005', 'Ukrainian', '1987-05-12', 'UA1122334', 'CUAET', 'active', 'forms_generated', 'CUAET pathway — currently on visitor visa'],
      ['James', 'Okafor', 'james.okafor@gmail.com', '905-555-6006', 'Nigerian', '1993-09-25', 'NG7788990', 'Work Permit', 'active', 'submitted_ircc', 'Closed work permit — spousal'],
      ['Yuki', 'Tanaka', 'yuki.tanaka@icloud.com', '778-555-7007', 'Japanese', '1996-12-03', 'JP2233445', 'Visitor Visa', 'active', 'lead', 'Tourist visa for family visit'],
      ['Sofia', 'Petrov', 'sofia.petrov@gmail.com', '613-555-8008', 'Russian', '1991-04-18', 'RU6677889', 'Express Entry', 'active', 'approved', 'PR approved — landing appointment pending'],
    ];
    const clientIds = [];
    for (const [fn, ln, email, phone, nat, dob, passport, visa, status, stage, notes] of clients) {
      const r = await client.query(
        `INSERT INTO clients (first_name, last_name, email, phone, nationality, date_of_birth, passport_number, visa_type, status, pipeline_stage, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [fn, ln, email, phone, nat, dob, passport, visa, status, stage, notes]
      );
      clientIds.push(r.rows[0].id);
    }
    console.log('✅ Clients seeded:', clientIds.length);

    // ── CLIENT_DATA (PIF fields for first 4 clients) ──
    const pifFields = [
      ['personal.given_name', 'Arjun'], ['personal.family_name', 'Mehta'], ['personal.dob', '1990-03-15'],
      ['personal.country_of_birth', 'India'], ['personal.citizenship', 'Indian'], ['contact.email', 'arjun.mehta@gmail.com'],
      ['contact.phone', '647-555-1001'], ['address.street', '45 Yonge St, Unit 1204'], ['address.city', 'Toronto'],
      ['address.province', 'ON'], ['address.postal_code', 'M5E 1J4'],
    ];
    for (const [key, val] of pifFields) {
      await client.query(
        `INSERT INTO client_data (client_id, field_key, field_value, source) VALUES ($1,$2,$3,'pif')`,
        [clientIds[0], key, val]
      );
    }
    const pifFields2 = [
      ['personal.given_name', 'Wei'], ['personal.family_name', 'Zhang'], ['personal.dob', '1988-07-22'],
      ['personal.country_of_birth', 'China'], ['personal.citizenship', 'Chinese'], ['contact.email', 'wei.zhang@outlook.com'],
      ['education.highest_degree', 'PhD Computer Science'], ['education.institution', 'University of Toronto'],
    ];
    for (const [key, val] of pifFields2) {
      await client.query(
        `INSERT INTO client_data (client_id, field_key, field_value, source) VALUES ($1,$2,$3,'pif')`,
        [clientIds[1], key, val]
      );
    }
    const pifFields3 = [
      ['personal.given_name', 'Fatima'], ['personal.family_name', 'Al-Rashid'], ['personal.dob', '1995-11-08'],
      ['personal.country_of_birth', 'Iraq'], ['personal.citizenship', 'Iraqi'], ['work.current_occupation', 'Software Engineer'],
      ['work.years_experience', '5'], ['language.english_test', 'IELTS'], ['language.english_score', 'CLB 9'],
    ];
    for (const [key, val] of pifFields3) {
      await client.query(
        `INSERT INTO client_data (client_id, field_key, field_value, source) VALUES ($1,$2,$3,'pif')`,
        [clientIds[2], key, val]
      );
    }
    const pifFields4 = [
      ['personal.given_name', 'Carlos'], ['personal.family_name', 'Rivera'], ['personal.dob', '1992-01-30'],
      ['personal.country_of_birth', 'Mexico'], ['personal.citizenship', 'Mexican'], ['work.current_occupation', 'Mechanical Engineer'],
      ['work.noc_code', '21301'], ['work.employer', 'Magna International'],
    ];
    for (const [key, val] of pifFields4) {
      await client.query(
        `INSERT INTO client_data (client_id, field_key, field_value, source) VALUES ($1,$2,$3,'pif')`,
        [clientIds[3], key, val]
      );
    }
    console.log('✅ Client data (PIF) seeded');

    // ── EMPLOYERS (7) ──
    const employers = [
      ['Magna International', 'Magna Auto Parts', '123456789RC0001', 'Robert Turner', 'robert@magna.com', '905-555-1111', '337 Magna Dr', 'Aurora', 'ON', 'L4G 7K1', 'Automotive Manufacturing', 5200],
      ['Shopify Inc', null, '234567890RC0001', 'Lisa Wang', 'lisa.wang@shopify.com', '613-555-2222', '150 Elgin St', 'Ottawa', 'ON', 'K2P 1L4', 'Technology', 12000],
      ['Tim Hortons - Franchise #4412', 'Tim Hortons', '345678901RC0001', 'Ahmed Mansoor', 'ahmed@timhortons4412.ca', '416-555-3333', '88 Queen St W', 'Toronto', 'ON', 'M5H 2N2', 'Food Service', 25],
      ['Pacific Salmon Farms Ltd', null, '456789012RC0001', 'Jennifer Kwon', 'jen@pacificsalmon.ca', '250-555-4444', '1200 Marine Dr', 'Campbell River', 'BC', 'V9W 1A1', 'Agriculture/Aquaculture', 85],
      ['Prairie Health Medical Clinic', null, '567890123RC0001', 'Dr. Mark Stevens', 'mark@prairiehealth.ca', '306-555-5555', '400 Broadway Ave', 'Saskatoon', 'SK', 'S7N 1B5', 'Healthcare', 32],
      ['Banff Alpine Resort', 'Alpine Lodge Banff', '678901234RC0001', 'Christine Dubois', 'christine@banffalpine.ca', '403-555-6666', '500 Banff Ave', 'Banff', 'AB', 'T1L 1A1', 'Hospitality', 120],
      ['Northern Mining Corp', null, '789012345RC0001', 'George Blackwell', 'george@northernmining.ca', '867-555-7777', 'Hwy 4 Industrial Park', 'Yellowknife', 'NT', 'X1A 2P7', 'Mining', 340],
    ];
    const empIds = [];
    for (const [cn, tn, bn, contact, ce, cp, addr, city, prov, pc, ind, num] of employers) {
      const r = await client.query(
        `INSERT INTO employers (company_name, trade_name, business_number, contact_name, contact_email, contact_phone, address, city, province, postal_code, industry, num_employees)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [cn, tn, bn, contact, ce, cp, addr, city, prov, pc, ind, num]
      );
      empIds.push(r.rows[0].id);
    }
    console.log('✅ Employers seeded:', empIds.length);

    // ── EMPLOYER_CLIENTS (link some clients to employers) ──
    await client.query(`INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, status) VALUES ($1,$2,'Assembly Line Technician','2025-06-01',28.50,'hourly','active')`, [empIds[0], clientIds[0]]);
    await client.query(`INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, status) VALUES ($1,$2,'Senior Developer','2025-03-15',95000,'annual','active')`, [empIds[1], clientIds[2]]);
    await client.query(`INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, status) VALUES ($1,$2,'Mechanical Engineer','2025-09-01',42.00,'hourly','active')`, [empIds[0], clientIds[3]]);
    await client.query(`INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, status) VALUES ($1,$2,'Food Service Supervisor','2025-04-10',19.50,'hourly','active')`, [empIds[2], clientIds[4]]);
    await client.query(`INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, status) VALUES ($1,$2,'Registered Nurse','2025-07-01',45.00,'hourly','pending')`, [empIds[4], clientIds[5]]);
    console.log('✅ Employer-client links seeded');

    // ── LMIA APPLICATIONS (7) ──
    const lmias = [
      [empIds[0], clientIds[0], 'Assembly Line Technician', '93201', 'TEER 2', 28.50, 'hourly', 'Aurora, ON', 1, null, 'high_wage', 'submitted', '2025-05-01', null, null],
      [empIds[0], clientIds[3], 'Mechanical Engineer', '21301', 'TEER 1', 42.00, 'hourly', 'Aurora, ON', 1, null, 'high_wage', 'approved', '2025-04-15', '2025-06-20', '2026-06-20'],
      [empIds[1], clientIds[2], 'Senior Developer', '21232', 'TEER 1', 95000, 'annual', 'Ottawa, ON', 2, null, 'global_talent', 'approved', '2025-02-01', '2025-03-15', '2026-03-15'],
      [empIds[2], clientIds[4], 'Food Service Supervisor', '62020', 'TEER 2', 19.50, 'hourly', 'Toronto, ON', 1, null, 'low_wage', 'submitted', '2025-06-01', null, null],
      [empIds[4], clientIds[5], 'Registered Nurse', '31301', 'TEER 1', 45.00, 'hourly', 'Saskatoon, SK', 3, null, 'high_wage', 'draft', null, null, null],
      [empIds[5], null, 'Hotel Front Desk Agent', '64314', 'TEER 4', 17.00, 'hourly', 'Banff, AB', 5, null, 'low_wage', 'draft', null, null, null],
      [empIds[6], null, 'Heavy Equipment Operator', '73400', 'TEER 3', 38.00, 'hourly', 'Yellowknife, NT', 2, null, 'high_wage', 'submitted', '2025-05-20', null, null],
    ];
    const lmiaIds = [];
    for (const [eid, cid, jt, noc, teer, wage, wt, loc, num, ln, stream, status, sub, dec, exp] of lmias) {
      const r = await client.query(
        `INSERT INTO lmia_applications (employer_id, client_id, job_title, noc_code, teer_category, wage_offered, wage_type, work_location, num_positions, lmia_number, stream, status, submission_date, decision_date, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [eid, cid, jt, noc, teer, wage, wt, loc, num, ln, stream, status, sub, dec, exp]
      );
      lmiaIds.push(r.rows[0].id);
    }
    console.log('✅ LMIA applications seeded:', lmiaIds.length);

    // ── JOB BANK ADS (7) ──
    const ads = [
      [lmiaIds[0], empIds[0], 'JB-2025-1001', 'Assembly Line Technician', '93201', '2025-04-01', '2025-05-01', 'active', 4],
      [lmiaIds[1], empIds[0], 'JB-2025-1002', 'Mechanical Engineer', '21301', '2025-03-15', '2025-04-15', 'expired', 4],
      [lmiaIds[2], empIds[1], 'JB-2025-1003', 'Senior Developer', '21232', '2025-01-10', '2025-02-10', 'expired', 4],
      [lmiaIds[3], empIds[2], 'JB-2025-1004', 'Food Service Supervisor', '62020', '2025-05-15', '2025-06-15', 'active', 4],
      [lmiaIds[4], empIds[4], 'JB-2025-1005', 'Registered Nurse', '31301', '2025-06-01', '2025-07-01', 'active', 4],
      [lmiaIds[5], empIds[5], 'JB-2025-1006', 'Hotel Front Desk Agent', '64314', '2025-05-20', '2025-06-20', 'active', 4],
      [lmiaIds[6], empIds[6], 'JB-2025-1007', 'Heavy Equipment Operator', '73400', '2025-04-20', '2025-05-20', 'expired', 4],
    ];
    for (const [lid, eid, jbid, jt, noc, post, exp, status, weeks] of ads) {
      await client.query(
        `INSERT INTO job_bank_ads (lmia_id, employer_id, job_bank_id, job_title, noc_code, posting_date, expiry_date, status, min_weeks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [lid, eid, jbid, jt, noc, post, exp, status, weeks]
      );
    }
    console.log('✅ Job bank ads seeded');

    // ── RETAINERS (8) ──
    const retainers = [
      [clientIds[0], 'Work Permit - LMIA Based', 3500, 1500, 'active', '2025-07-01', '2025-05-10'],
      [clientIds[1], 'Study Permit Extension', 2000, 2000, 'paid', '2025-06-15', '2025-04-20'],
      [clientIds[2], 'Express Entry - FSW', 5000, 2500, 'active', '2025-08-01', '2025-03-01'],
      [clientIds[3], 'PNP - Ontario OINP', 6000, 3000, 'active', '2025-09-01', '2025-06-01'],
      [clientIds[4], 'CUAET Application', 1500, 1500, 'paid', null, '2025-04-05'],
      [clientIds[5], 'Spousal Work Permit', 3000, 1000, 'active', '2025-10-01', '2025-07-15'],
      [clientIds[6], 'Visitor Visa', 1000, 0, 'pending', '2025-08-15', null],
      [clientIds[7], 'PR Landing', 1500, 1500, 'paid', null, '2025-01-20'],
    ];
    const retainerIds = [];
    for (const [cid, svc, fee, paid, status, due, signed] of retainers) {
      const r = await client.query(
        `INSERT INTO retainers (client_id, service_type, retainer_fee, amount_paid, status, due_date, signed_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [cid, svc, fee, paid, status, due, signed]
      );
      retainerIds.push(r.rows[0].id);
    }
    console.log('✅ Retainers seeded:', retainerIds.length);

    // ── EMPLOYER FEES (7) ──
    const fees = [
      [empIds[0], lmiaIds[0], 'LMIA Application Fee - Technician', 1000, 'paid', '2025-04-01', '2025-04-30', '2025-04-25'],
      [empIds[0], lmiaIds[1], 'LMIA Application Fee - Engineer', 1000, 'paid', '2025-03-15', '2025-04-15', '2025-04-10'],
      [empIds[1], lmiaIds[2], 'Global Talent Stream Fee', 1000, 'paid', '2025-01-15', '2025-02-15', '2025-02-01'],
      [empIds[2], lmiaIds[3], 'LMIA Application Fee - Supervisor', 1000, 'unpaid', '2025-06-01', '2025-06-30', null],
      [empIds[4], lmiaIds[4], 'LMIA Application Fee - Nurse', 1000, 'unpaid', '2025-06-15', '2025-07-15', null],
      [empIds[5], lmiaIds[5], 'LMIA Application Fee - Front Desk', 1000, 'unpaid', '2025-05-20', '2025-06-20', null],
      [empIds[6], lmiaIds[6], 'LMIA Application Fee - Equipment Op', 1000, 'paid', '2025-04-20', '2025-05-20', '2025-05-15'],
    ];
    for (const [eid, lid, desc, amt, status, inv, due, paid] of fees) {
      await client.query(
        `INSERT INTO employer_fees (employer_id, lmia_id, description, amount, status, invoice_date, due_date, paid_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [eid, lid, desc, amt, status, inv, due, paid]
      );
    }
    console.log('✅ Employer fees seeded');

    // ── TASKS (8) ──
    const tasks = [
      [clientIds[0], 'Collect passport scan', 'high', 'Document Collection', '2025-06-10', false, 'Priya Patel'],
      [clientIds[0], 'Submit LMIA application', 'high', 'LMIA', '2025-06-15', false, 'Sarah Kim'],
      [clientIds[1], 'Verify enrollment letter', 'medium', 'Document Collection', '2025-06-20', true, 'David Chen'],
      [clientIds[2], 'Calculate CRS score', 'high', 'Express Entry', '2025-05-30', true, 'Sarah Kim'],
      [clientIds[2], 'Submit Express Entry profile', 'high', 'Express Entry', '2025-06-25', false, 'Sarah Kim'],
      [clientIds[3], 'Prepare OINP application package', 'medium', 'PNP', '2025-07-01', false, 'Priya Patel'],
      [clientIds[5], 'Draft spousal sponsorship letter', 'medium', 'Sponsorship', '2025-08-01', false, 'Amira Hassan'],
      [clientIds[6], 'Request travel itinerary from client', 'low', 'Visitor Visa', '2025-07-15', false, 'Jason Lee'],
    ];
    for (const [cid, title, prio, cat, due, done, by] of tasks) {
      await client.query(
        `INSERT INTO tasks (client_id, title, priority, category, due_date, done, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [cid, title, prio, cat, due, done, by]
      );
    }
    console.log('✅ Tasks seeded');

    // ── DEPENDENTS / FAMILY MEMBERS (8) ──
    const deps = [
      [clientIds[0], 'Sunita', 'Mehta', 'Spouse', '1992-06-20', 'Indian', null, 'sunita.mehta@gmail.com', null, 'Female', 'Married'],
      [clientIds[0], 'Rohan', 'Mehta', 'Child', '2018-03-10', 'Indian', null, null, null, 'Male', 'Single'],
      [clientIds[2], 'Yusuf', 'Al-Rashid', 'Spouse', '1994-02-14', 'Iraqi', 'A77665544', 'yusuf.r@yahoo.com', null, 'Male', 'Married'],
      [clientIds[3], 'Isabella', 'Rivera', 'Spouse', '1993-08-05', 'Mexican', 'MEX9988776', 'isabella.r@hotmail.com', null, 'Female', 'Married'],
      [clientIds[3], 'Diego', 'Rivera', 'Child', '2020-12-01', 'Mexican', null, null, null, 'Male', 'Single'],
      [clientIds[5], 'Ngozi', 'Okafor', 'Spouse', '1995-04-17', 'Nigerian', 'NG1122334', 'ngozi.o@gmail.com', null, 'Female', 'Married'],
      [clientIds[7], 'Dmitri', 'Petrov', 'Spouse', '1989-10-22', 'Russian', 'RU3344556', 'dmitri.p@gmail.com', null, 'Male', 'Married'],
      [clientIds[7], 'Anya', 'Petrov', 'Child', '2019-07-15', 'Russian', null, null, null, 'Female', 'Single'],
    ];
    for (const [cid, fn, ln, rel, dob, nat, pp, email, phone, gender, ms] of deps) {
      await client.query(
        `INSERT INTO dependents (client_id, first_name, last_name, relationship, date_of_birth, nationality, passport_number, email, phone, gender, marital_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [cid, fn, ln, rel, dob, nat, pp, email, phone, gender, ms]
      );
    }
    console.log('✅ Dependents seeded');

    // ── CLIENT NOTES (8) ──
    const notes = [
      [clientIds[0], 'Client prefers communication via WhatsApp. Employer confirmed start date.', 'Priya Patel', false],
      [clientIds[1], 'Enrollment confirmation received from UofT registrar.', 'David Chen', true],
      [clientIds[2], 'CRS score verified at 478. Strong candidate for next EE draw.', 'Sarah Kim', true],
      [clientIds[2], 'Client has 3 years Canadian work experience — eligible for CEC too.', 'Sarah Kim', false],
      [clientIds[3], 'OINP nomination letter expected by end of July.', 'Priya Patel', false],
      [clientIds[4], 'All CUAET documents submitted. Awaiting biometrics appointment.', 'Amira Hassan', true],
      [clientIds[5], 'Spousal relationship evidence package being compiled.', 'Amira Hassan', false],
      [clientIds[7], 'PR card expected within 3 weeks. Client reminded about landing obligations.', 'Sarah Kim', true],
    ];
    for (const [cid, content, author, pinned] of notes) {
      await client.query(
        `INSERT INTO client_notes (client_id, content, author, is_pinned) VALUES ($1,$2,$3,$4)`,
        [cid, content, author, pinned]
      );
    }
    console.log('✅ Client notes seeded');

    // ── CLIENT TIMELINE (8) ──
    const timeline = [
      [clientIds[0], 'status_change', 'Client onboarded', 'Initial consultation completed, retainer signed', null, 'Priya Patel'],
      [clientIds[0], 'document', 'Passport uploaded', 'Passport scan received and verified', null, 'Priya Patel'],
      [clientIds[1], 'pif', 'PIF submitted', 'Personal Information Form completed by client', null, 'David Chen'],
      [clientIds[2], 'status_change', 'Moved to PIF Submitted', 'PIF received and under review', null, 'Sarah Kim'],
      [clientIds[3], 'status_change', 'Moved to Under Review', 'All documents received, application under review', null, 'Priya Patel'],
      [clientIds[4], 'status_change', 'Forms generated', 'IRCC forms generated and sent for signature', null, 'Amira Hassan'],
      [clientIds[5], 'status_change', 'Application submitted', 'Work permit application submitted to IRCC', null, 'Amira Hassan'],
      [clientIds[7], 'status_change', 'PR Approved', 'Permanent residence application approved', null, 'Sarah Kim'],
    ];
    for (const [cid, type, title, desc, meta, by] of timeline) {
      await client.query(
        `INSERT INTO client_timeline (client_id, event_type, title, description, metadata, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [cid, type, title, desc, meta, by]
      );
    }
    console.log('✅ Client timeline seeded');

    // ── INVOICES (8) ──
    const invoices = [
      [clientIds[0], 'INV-2025-001', 'Work Permit - LMIA Based (Retainer)', 3500, 'partial', '2025-06-01', null],
      [clientIds[1], 'INV-2025-002', 'Study Permit Extension', 2000, 'paid', '2025-05-15', '2025-05-20'],
      [clientIds[2], 'INV-2025-003', 'Express Entry - FSW Application', 5000, 'partial', '2025-07-01', null],
      [clientIds[3], 'INV-2025-004', 'PNP - Ontario OINP', 6000, 'partial', '2025-08-01', null],
      [clientIds[4], 'INV-2025-005', 'CUAET Application', 1500, 'paid', '2025-04-15', '2025-04-20'],
      [clientIds[5], 'INV-2025-006', 'Spousal Work Permit', 3000, 'sent', '2025-09-01', null],
      [clientIds[6], 'INV-2025-007', 'Visitor Visa Application', 1000, 'draft', '2025-07-15', null],
      [clientIds[7], 'INV-2025-008', 'PR Landing Services', 1500, 'paid', '2025-02-01', '2025-02-05'],
    ];
    const invoiceIds = [];
    for (const [cid, num, desc, amt, status, due, paid] of invoices) {
      const r = await client.query(
        `INSERT INTO invoices (client_id, invoice_number, description, amount, status, due_date, paid_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [cid, num, desc, amt, status, due, paid]
      );
      invoiceIds.push(r.rows[0].id);
    }
    console.log('✅ Invoices seeded');

    // ── PAYMENTS (8 - linked to retainers) ──
    const payments = [
      [retainerIds[0], clientIds[0], 1000, 'e-transfer', '2025-05-10', 'ET-001', 'Initial deposit'],
      [retainerIds[0], clientIds[0], 500, 'credit_card', '2025-06-01', 'CC-002', 'Second installment'],
      [retainerIds[1], clientIds[1], 2000, 'e-transfer', '2025-04-20', 'ET-003', 'Full payment'],
      [retainerIds[2], clientIds[2], 2500, 'e-transfer', '2025-03-05', 'ET-004', 'Initial deposit'],
      [retainerIds[3], clientIds[3], 3000, 'wire_transfer', '2025-06-05', 'WT-005', 'First installment'],
      [retainerIds[4], clientIds[4], 1500, 'e-transfer', '2025-04-05', 'ET-006', 'Full payment'],
      [retainerIds[5], clientIds[5], 1000, 'credit_card', '2025-07-15', 'CC-007', 'Initial deposit'],
      [retainerIds[7], clientIds[7], 1500, 'e-transfer', '2025-01-20', 'ET-008', 'Full payment'],
    ];
    for (const [rid, cid, amt, method, date, ref, notes] of payments) {
      await client.query(
        `INSERT INTO payments (retainer_id, client_id, amount, payment_method, payment_date, reference_number, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rid, cid, amt, method, date, ref, notes]
      );
    }
    console.log('✅ Payments seeded');

    // ── TRANSACTIONS (8) ──
    const txns = [
      [clientIds[0], invoiceIds[0], 'trust_deposit', 1000, 'E-transfer deposit — Arjun Mehta', 'ET-001', 'consultation', 'Admin'],
      [clientIds[0], invoiceIds[0], 'trust_deposit', 500, 'Credit card payment — Arjun Mehta', 'CC-002', 'document_collection', 'Admin'],
      [clientIds[1], invoiceIds[1], 'trust_deposit', 2000, 'Full payment — Wei Zhang', 'ET-003', 'document_collection', 'Admin'],
      [clientIds[2], invoiceIds[2], 'trust_deposit', 2500, 'Deposit — Fatima Al-Rashid', 'ET-004', 'pif_submitted', 'Admin'],
      [clientIds[3], invoiceIds[3], 'trust_deposit', 3000, 'Wire transfer — Carlos Rivera', 'WT-005', 'under_review', 'Admin'],
      [clientIds[1], invoiceIds[1], 'milestone_release', 2000, 'Milestone: Study permit filed', null, 'document_collection', 'Admin'],
      [clientIds[4], invoiceIds[4], 'trust_deposit', 1500, 'Full payment — Olena Kovalenko', 'ET-006', 'forms_generated', 'Admin'],
      [clientIds[7], invoiceIds[7], 'trust_deposit', 1500, 'Full payment — Sofia Petrov', 'ET-008', 'approved', 'Admin'],
    ];
    for (const [cid, iid, type, amt, desc, ref, stage, by] of txns) {
      await client.query(
        `INSERT INTO transactions (client_id, invoice_id, type, amount, description, reference_number, pipeline_stage, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cid, iid, type, amt, desc, ref, stage, by]
      );
    }
    console.log('✅ Transactions seeded');

    // ── TRUST ACCOUNTS (8) ──
    for (let i = 0; i < clientIds.length; i++) {
      const balances = [1500, 0, 2500, 3000, 0, 1000, 0, 0];
      await client.query(
        `INSERT INTO trust_accounts (client_id, balance) VALUES ($1,$2)`,
        [clientIds[i], balances[i]]
      );
    }
    console.log('✅ Trust accounts seeded');

    // ── CLIENT DEADLINES (8) ──
    const deadlines = [
      [clientIds[0], 'LMIA submission deadline', '2025-06-30', 'lmia', 'pending', 14],
      [clientIds[1], 'Study permit expires', '2025-09-30', 'permit_expiry', 'pending', 30],
      [clientIds[2], 'Express Entry profile expiry', '2026-03-01', 'express_entry', 'pending', 30],
      [clientIds[3], 'OINP nomination deadline', '2025-08-15', 'pnp', 'pending', 14],
      [clientIds[4], 'Biometrics appointment', '2025-07-10', 'biometrics', 'pending', 7],
      [clientIds[5], 'Work permit submission', '2025-09-15', 'submission', 'pending', 14],
      [clientIds[6], 'Visitor visa application', '2025-08-01', 'submission', 'pending', 7],
      [clientIds[7], 'PR landing appointment', '2025-07-20', 'landing', 'pending', 7],
    ];
    for (const [cid, title, date, cat, status, rem] of deadlines) {
      await client.query(
        `INSERT INTO client_deadlines (client_id, title, deadline_date, category, status, reminder_days)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [cid, title, date, cat, status, rem]
      );
    }
    console.log('✅ Client deadlines seeded');

    // ── PIF FIELD VERIFICATIONS (for client 3 - Fatima, who is in pif_submitted stage) ──
    const verFields = [
      ['personal.given_name', true, null], ['personal.family_name', true, null], ['personal.dob', true, null],
      ['personal.country_of_birth', true, null], ['personal.citizenship', true, null],
      ['work.current_occupation', true, 'Verified via employment letter'],
      ['work.years_experience', false, 'Need official reference letters'],
      ['language.english_test', true, null], ['language.english_score', true, 'IELTS scores verified'],
    ];
    for (const [key, verified, comment] of verFields) {
      await client.query(
        `INSERT INTO pif_field_verifications (client_id, field_key, verified, comment, verified_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [clientIds[2], key, verified, comment, userIds[1]]
      );
    }
    console.log('✅ PIF verifications seeded');

    // ── AUDIT LOGS (8) ──
    const logs = [
      [clientIds[0], 'client', clientIds[0], 'create', null, null, null, userIds[2]],
      [clientIds[0], 'client', clientIds[0], 'update', 'pipeline_stage', 'lead', 'consultation', userIds[2]],
      [clientIds[1], 'client', clientIds[1], 'create', null, null, null, userIds[3]],
      [clientIds[2], 'client', clientIds[2], 'update', 'pipeline_stage', 'consultation', 'pif_submitted', userIds[1]],
      [clientIds[2], 'pif_verification', clientIds[2], 'verify', 'personal.given_name', 'unverified', 'verified', userIds[1]],
      [clientIds[3], 'client', clientIds[3], 'update', 'pipeline_stage', 'document_collection', 'under_review', userIds[2]],
      [clientIds[5], 'client', clientIds[5], 'update', 'pipeline_stage', 'forms_generated', 'submitted_ircc', userIds[4]],
      [clientIds[7], 'client', clientIds[7], 'update', 'status', 'active', 'approved', userIds[1]],
    ];
    for (const [cid, etype, eid, action, fk, ov, nv, by] of logs) {
      await client.query(
        `INSERT INTO audit_logs (client_id, entity_type, entity_id, action, field_key, old_value, new_value, changed_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cid, etype, eid, action, fk, ov, nv, by]
      );
    }
    console.log('✅ Audit logs seeded');

    // ── OPERATING ACCOUNT ──
    await client.query(`INSERT INTO operating_accounts (balance) VALUES (15000) ON CONFLICT DO NOTHING`);
    console.log('✅ Operating account seeded');

    await client.query('COMMIT');
    console.log('\n🎉 All seed data inserted successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
