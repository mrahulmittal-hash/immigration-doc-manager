#!/usr/bin/env node
/**
 * Download all IRCC fillable PDF forms from canada.ca and upload to the web application.
 * Usage: node server/scripts/download-ircc-forms.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:3001/api/ircc-templates';
const DOWNLOAD_DIR = '/tmp/ircc-forms';

const FORMS = [
  { formNumber: 'IMM 0008', name: 'Generic Application Form for Canada', visaType: 'Express Entry', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm0008/01-03-2025/imm0008e.pdf' },
  { formNumber: 'IMM 0008 Schedule A', name: 'Background/Declaration', visaType: 'Express Entry', url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008_schedule_a.pdf' },
  { formNumber: 'IMM 0008 Schedule 12', name: 'Additional Information — Refugee Claimant', visaType: 'Refugee Claim', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm0008-sch12/01-11-2025/imm0008_12e.pdf' },
  { formNumber: 'IMM 5669', name: 'Schedule A – Declaration', visaType: 'Express Entry', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5669/01-05-2021/imm5669e.pdf' },
  { formNumber: 'IMM 5406', name: 'Additional Family Information', visaType: 'Express Entry', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5406/01-04-2025/imm5406e.pdf' },
  { formNumber: 'IMM 5562', name: 'Supplementary Information — Your Travels', visaType: 'Express Entry', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5562/01-07-2024/imm5562e.pdf' },
  { formNumber: 'IMM 1294', name: 'Application for a Study Permit', visaType: 'Study Permit', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1294/01-10-2024/imm1294e.pdf' },
  { formNumber: 'IMM 5645', name: 'Family Information', visaType: 'Study Permit', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5645/01-01-2021/imm5645e.pdf' },
  { formNumber: 'IMM 1295', name: 'Application for a Work Permit (PGWP)', visaType: 'Work Permit (PGWP)', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1295/01-09-2023/imm1295e.pdf' },
  { formNumber: 'IMM 1344', name: 'Application to Sponsor', visaType: 'Spousal Sponsorship', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1344/01-09-2024/imm1344e.pdf' },
  { formNumber: 'IMM 5532', name: 'Relationship Information and Sponsorship Evaluation', visaType: 'Spousal Sponsorship', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5532/01-02-2021/imm5532e.pdf' },
  { formNumber: 'IMM 5257', name: 'Application for Visitor Visa (TRV)', visaType: 'Visitor Visa (TRV)', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5257/01-09-2023/imm5257e.pdf' },
  { formNumber: 'IMM 5768', name: 'Financial Evaluation for Parents and Grandparents Sponsorship', visaType: 'Parent/Grandparent Sponsorship', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5768/01-07-2024/imm5768e.pdf' },
  { formNumber: 'IMM 5476', name: 'Statutory Declaration of Common-Law Union', visaType: 'Spousal Sponsorship', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5476/01-11-2025/imm5476e.pdf' },
  { formNumber: 'IMM 5444', name: 'Application for a Super Visa', visaType: 'Super Visa', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5444/01-09-2024/imm5444e.pdf' },
  { formNumber: 'CIT 0002', name: 'Application for Canadian Citizenship', visaType: 'Citizenship Application', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/cit0002/01-02-2026/cit0002e.pdf' },
  { formNumber: 'CIT 0007', name: 'Application for Citizenship Certificate', visaType: 'Citizenship Application', url: 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/cit0007/01-03-2024/cit0007e.pdf' },
  { formNumber: 'EMP 5593', name: 'Labour Market Impact Assessment Application', visaType: 'LMIA Application', url: 'https://www.canada.ca/content/dam/esdc-edsc/documents/services/foreign-workers/form/emp5593.pdf' },
  { formNumber: 'EMP 5575', name: 'Schedule B – LMIA Application', visaType: 'LMIA Application', url: 'https://catalogue.servicecanada.gc.ca/apps/EForms/pdf/en/ESDC-EMP5575.pdf' },
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = (reqUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      protocol.get(reqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, reqUrl).href;
          const redirProtocol = redirectUrl.startsWith('https') ? https : http;
          redirProtocol.get(redirectUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
            if (res2.statusCode !== 200) return reject(new Error(`HTTP ${res2.statusCode}`));
            const stream = fs.createWriteStream(destPath);
            res2.pipe(stream);
            stream.on('finish', () => stream.close(() => resolve()));
            stream.on('error', reject);
          }).on('error', reject);
          return;
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const stream = fs.createWriteStream(destPath);
        res.pipe(stream);
        stream.on('finish', () => stream.close(() => resolve()));
        stream.on('error', reject);
      }).on('error', reject);
    };
    request(url);
  });
}

function uploadFile(formNumber, filePath, formName, visaType) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileData = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const parts = [];
    // File part
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`);
    parts.push(fileData);
    parts.push('\r\n');
    // form_name
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="form_name"\r\n\r\n${formName}\r\n`);
    // visa_type
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="visa_type"\r\n\r\n${visaType}\r\n`);
    parts.push(`--${boundary}--\r\n`);

    const body = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));

    const encodedFormNumber = encodeURIComponent(formNumber);
    const url = new URL(`${API_BASE}/${encodedFormNumber}/upload`);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  let downloaded = 0, failed = 0, uploaded = 0;

  console.log('=== Downloading IRCC Form PDFs from canada.ca ===\n');

  for (const form of FORMS) {
    const safeName = form.formNumber.replace(/\s+/g, '_');
    const destPath = path.join(DOWNLOAD_DIR, `${safeName}.pdf`);

    process.stdout.write(`Downloading: ${form.formNumber} ... `);
    try {
      await downloadFile(form.url, destPath);
      const stats = fs.statSync(destPath);
      if (stats.size < 1024) {
        console.log(`✗ Too small (${stats.size} bytes)`);
        fs.unlinkSync(destPath);
        failed++;
        continue;
      }
      // Check PDF header
      const header = Buffer.alloc(4);
      const fd = fs.openSync(destPath, 'r');
      fs.readSync(fd, header, 0, 4, 0);
      fs.closeSync(fd);
      if (header.toString() !== '%PDF') {
        console.log('✗ Not a valid PDF');
        fs.unlinkSync(destPath);
        failed++;
        continue;
      }
      console.log(`✓ ${(stats.size / 1024).toFixed(0)} KB`);
      downloaded++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Download Summary: ${downloaded} OK, ${failed} failed ===\n`);
  console.log('=== Uploading to Web Application ===\n');

  for (const form of FORMS) {
    const safeName = form.formNumber.replace(/\s+/g, '_');
    const filePath = path.join(DOWNLOAD_DIR, `${safeName}.pdf`);

    if (!fs.existsSync(filePath)) {
      console.log(`Skipping: ${form.formNumber} (no PDF)`);
      continue;
    }

    process.stdout.write(`Uploading: ${form.formNumber} ... `);
    try {
      await uploadFile(form.formNumber, filePath, form.name, form.visaType);
      console.log('✓');
      uploaded++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  console.log(`\n=== Final Summary ===`);
  console.log(`PDFs Downloaded: ${downloaded} / ${FORMS.length}`);
  console.log(`PDFs Uploaded:   ${uploaded} / ${downloaded}`);

  // Cleanup
  fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
  console.log('\nTemp files cleaned up. Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
