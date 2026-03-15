require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'propgent',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function main() {
  // 1. Create tables if not exist
  await pool.query(`CREATE TABLE IF NOT EXISTS dependents (
    id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL, relationship TEXT NOT NULL,
    date_of_birth TEXT, nationality TEXT, passport_number TEXT, email TEXT, phone TEXT,
    gender TEXT, marital_status TEXT, photo_path TEXT, notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS immigration_photos (
    id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    dependent_id INTEGER REFERENCES dependents(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL, person_type TEXT NOT NULL DEFAULT 'client',
    filename TEXT NOT NULL, original_name TEXT NOT NULL, file_path TEXT NOT NULL,
    file_size INTEGER, status TEXT DEFAULT 'pending', notes TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  console.log('Tables created/verified');

  // 2. Create Anish Garg client
  let clientId;
  const existing = await pool.query("SELECT id FROM clients WHERE first_name='Anish' AND last_name='Garg'");
  if (existing.rows.length > 0) {
    clientId = existing.rows[0].id;
    console.log('Anish Garg already exists, id:', clientId);
  } else {
    const r = await pool.query(
      `INSERT INTO clients (first_name, last_name, nationality, visa_type, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Anish', 'Garg', 'Indian', 'Visitor Visa (TRV)', 'active', 'Family visitor visa application with multiple dependents.']
    );
    clientId = r.rows[0].id;
    console.log('Created Anish Garg, id:', clientId);
  }

  // 3. Upload documents for Anish Garg via direct DB insert
  const VISA_DIR = path.join(process.env.USERPROFILE || process.env.HOME, 'OneDrive', 'Desktop', 'Visas');
  const uploadsDir = path.join(__dirname, 'uploads', 'documents');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // Map of files to upload with categories
  const anishDocs = [
    { file: 'Anish Garg Voter.pdf', category: 'identity' },
    { file: 'Bonafide Cert Tanishtha Garg.pdf', category: 'education' },
    { file: 'Geetanjli Voter Card.pdf', category: 'identity' },
    { file: 'Hridhika Voter card.pdf', category: 'identity' },
    { file: 'IMM5739_2-1DNGDHUJ.pdf', category: 'general' },
    { file: 'IMM5739_2-1DNGG5B7.pdf', category: 'general' },
    { file: 'IMM5739_2-1DNGJ7J5.pdf', category: 'general' },
    { file: 'Rajinder Pal Voter.pdf', category: 'identity' },
    { file: 'Ravnish Kumar Voter.pdf', category: 'identity' },
    { file: 'Shree ram Atta Chakki Statement.pdf', category: 'financial' },
    { file: 'Soma Devi Voter.pdf', category: 'identity' },
    { file: 'Sonia Voter.pdf', category: 'identity' },
    { file: 'Swastik Rice Mills Bank Statement.pdf', category: 'financial' },
    { file: 'proof of relation- Ravi and anish.pdf', category: 'letter' },
  ];

  // Daddy folder docs
  const daddyDocs = [
    { file: 'Daddy/Passport Rajinder Pal.pdf', category: 'passport' },
    { file: 'Daddy/Rajinder Pal Adhaar.pdf', category: 'identity' },
    { file: 'Daddy/Rajinder pal Birth.pdf', category: 'identity' },
    { file: 'Daddy/Rajinder pal Marriage.pdf', category: 'identity' },
    { file: 'Daddy/Rajinder pal Name.pdf', category: 'identity' },
    { file: 'Daddy/Rajinder Pal 2023-24.pdf', category: 'financial' },
    { file: 'Daddy/Rajinder Pal 2024-25.pdf', category: 'financial' },
    { file: 'Daddy/Soma Devi Passport.pdf', category: 'passport' },
    { file: 'Daddy/Soma Devi Adhaar.pdf', category: 'identity' },
    { file: 'Daddy/Soma Devi Birth.pdf', category: 'identity' },
    { file: 'Daddy/Soma Devi 2023-24.pdf', category: 'financial' },
    { file: 'Daddy/Soma Devi 2024-25.pdf', category: 'financial' },
    { file: 'Daddy/BANK STATEMENT BHARTI 3 MONTHS.pdf', category: 'financial' },
    { file: 'Daddy/Business Registration Bharti.pdf', category: 'employment' },
    { file: 'Daddy/IMM5713E.pdf', category: 'general' },
    { file: 'Daddy/imm5257e Rajinder Pal.pdf', category: 'general' },
    { file: 'Daddy/imm5257e Soma Devi.pdf', category: 'general' },
    { file: 'Daddy/imm5476e.pdf', category: 'general' },
    { file: 'Daddy/imm5645e FILLED Rajinder Pal.pdf', category: 'general' },
    { file: 'Daddy/imm5645e FILLED SOMA DEVI .pdf', category: 'general' },
  ];

  // Ravi folder docs
  const raviDocs = [
    { file: 'Ravi/Ravnish Kumar Passport.pdf', category: 'passport' },
    { file: 'Ravi/Ravnish Kumar Adhaar.pdf', category: 'identity' },
    { file: 'Ravi/Ravnish Kumar Birth.pdf', category: 'identity' },
    { file: 'Ravi/Ravnish Kumar Marriage.pdf', category: 'identity' },
    { file: 'Ravi/Ravnish Kumar 2023-24.pdf', category: 'financial' },
    { file: 'Ravi/Ravnish Kumar 2024-25.pdf', category: 'financial' },
    { file: 'Ravi/Ravi Balance Certificate.pdf', category: 'financial' },
    { file: 'Ravi/Sonia Passport.pdf', category: 'passport' },
    { file: 'Ravi/Sonia Adhaar.pdf', category: 'identity' },
    { file: 'Ravi/Sonia Garg Birth.pdf', category: 'identity' },
    { file: 'Ravi/Sonia ITR 2023-24.pdf', category: 'financial' },
    { file: 'Ravi/Sonia 2024-25.pdf', category: 'financial' },
    { file: 'Ravi/Sonia Balance Certificate.pdf', category: 'financial' },
    { file: 'Ravi/BANK STATEMENT SONIA 3 MONTHS.pdf', category: 'financial' },
    { file: 'Ravi/Business Registration Sonia.pdf', category: 'employment' },
    { file: 'Ravi/Swastik Rice Mills Partnership Deed.pdf', category: 'employment' },
    { file: 'Ravi/UDYAM SWASTIK_250213_175531.pdf', category: 'employment' },
    { file: 'Ravi/Convocation Letter of Support.pdf', category: 'letter' },
    { file: 'Ravi/Shrishitika Passport.pdf', category: 'passport' },
    { file: 'Ravi/Shrishitika Birth Certificate.pdf', category: 'identity' },
    { file: 'Ravi/hiya birth.pdf', category: 'identity' },
    { file: 'Ravi/Aadhaar SHIVI.pdf', category: 'identity' },
    { file: 'Ravi/Ravi imm5257e.pdf', category: 'general' },
    { file: 'Ravi/Ravi imm5257_1e.pdf', category: 'general' },
    { file: 'Ravi/Ravi imm5645e.pdf', category: 'general' },
    { file: 'Ravi/Sonia imm5257e.pdf', category: 'general' },
    { file: 'Ravi/Sonia imm5257_1e.pdf', category: 'general' },
    { file: 'Ravi/Sonia imm5645e.pdf', category: 'general' },
    { file: 'Ravi/Shivi imm5257e.pdf', category: 'general' },
    { file: 'Ravi/Shivi imm5257_1e.pdf', category: 'general' },
  ];

  const allDocs = [...anishDocs, ...daddyDocs, ...raviDocs];
  let uploaded = 0;

  for (const doc of allDocs) {
    const srcPath = path.join(VISA_DIR, doc.file);
    if (!fs.existsSync(srcPath)) {
      console.log('  SKIP (not found):', doc.file);
      continue;
    }

    // Check if already uploaded
    const dup = await pool.query(
      "SELECT id FROM documents WHERE client_id = $1 AND original_name = $2",
      [clientId, path.basename(doc.file)]
    );
    if (dup.rows.length > 0) {
      console.log('  SKIP (exists):', path.basename(doc.file));
      continue;
    }

    // Copy file to uploads dir
    const destName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${path.basename(doc.file)}`;
    const destPath = path.join(uploadsDir, destName);
    fs.copyFileSync(srcPath, destPath);

    const stats = fs.statSync(srcPath);
    const ext = path.extname(doc.file).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

    await pool.query(
      `INSERT INTO documents (client_id, filename, original_name, file_path, file_type, file_size, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [clientId, destName, path.basename(doc.file), destPath, mimeType, stats.size, doc.category]
    );
    uploaded++;
    console.log('  Uploaded:', path.basename(doc.file), '→', doc.category);
  }

  // Also upload photo files (jpg/jpeg/png) as immigration photos
  const photoFiles = [
    { file: 'Daddy/Rajinder Pal.jpg', name: 'Rajinder Pal', type: 'dependent' },
    { file: 'Daddy/Soma Devi.jpg', name: 'Soma Devi', type: 'dependent' },
    { file: 'Ravi/Ravnish Kumar.jpg', name: 'Ravnish Kumar', type: 'dependent' },
    { file: 'Ravi/Sonia.jpg', name: 'Sonia Garg', type: 'dependent' },
    { file: 'Ravi/Shrishitika.jpg', name: 'Shrishitika', type: 'dependent' },
  ];

  const photosDir = path.join(__dirname, 'uploads', 'photos');
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

  for (const pf of photoFiles) {
    const srcPath = path.join(VISA_DIR, pf.file);
    if (!fs.existsSync(srcPath)) continue;

    const dup = await pool.query(
      "SELECT id FROM immigration_photos WHERE client_id = $1 AND original_name = $2",
      [clientId, path.basename(pf.file)]
    );
    if (dup.rows.length > 0) continue;

    const destName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${path.basename(pf.file)}`;
    const destPath = path.join(photosDir, destName);
    fs.copyFileSync(srcPath, destPath);
    const stats = fs.statSync(srcPath);

    await pool.query(
      `INSERT INTO immigration_photos (client_id, person_name, person_type, filename, original_name, file_path, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [clientId, pf.name, pf.type, destName, path.basename(pf.file), destPath, stats.size]
    );
    console.log('  Photo uploaded:', pf.name, path.basename(pf.file));
  }

  console.log(`\nDone! Uploaded ${uploaded} documents for Anish Garg (client id: ${clientId})`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
