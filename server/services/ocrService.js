const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

// ICAO 9303 MRZ parsing for TD3 passports (2 lines × 44 chars)
function parseMRZ(text) {
  // Clean up OCR noise: normalize characters
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length >= 30);

  // Find MRZ lines (mostly uppercase + digits + <)
  const mrzLines = lines.filter(l => {
    const mrzChars = l.replace(/[^A-Z0-9<]/g, '');
    return mrzChars.length >= 30 && mrzChars.length / l.replace(/\s/g, '').length > 0.8;
  });

  if (mrzLines.length < 2) return null;

  // Take the last two qualifying lines (MRZ is at bottom of passport)
  const line1 = mrzLines[mrzLines.length - 2].replace(/[^A-Z0-9<]/g, '');
  const line2 = mrzLines[mrzLines.length - 1].replace(/[^A-Z0-9<]/g, '');

  const result = {};

  // Line 1: P<CTYSURNAME<<GIVENNAMES<<<...
  const m1 = line1.match(/^P[<OICD]?([A-Z<]{3})([A-Z<]+)<<([A-Z<]+)/);
  if (m1) {
    result.country_of_issue = m1[1].replace(/</g, '');
    result.last_name = m1[2].replace(/</g, ' ').trim();
    result.first_name = m1[3].replace(/</g, ' ').trim();
    result.full_name = `${result.first_name} ${result.last_name}`;
  }

  // Line 2: PASSPORT#<CHECKNAT YYMMDDCHKSEX YYMMDDCHK...
  // Positions: 0-8=passport#, 9=check, 10-12=nationality, 13-18=DOB, 19=check, 20=sex, 21-26=expiry, 27=check
  if (line2.length >= 28) {
    result.passport_number = line2.substring(0, 9).replace(/</g, '').replace(/O/g, '0');

    const nat = line2.substring(10, 13).replace(/</g, '');
    if (nat.length >= 2) result.nationality = nat;

    const dob = line2.substring(13, 19);
    if (/^\d{6}$/.test(dob)) {
      const yy = parseInt(dob.substring(0, 2));
      const mm = dob.substring(2, 4);
      const dd = dob.substring(4, 6);
      const century = yy > 50 ? '19' : '20';
      result.date_of_birth = `${century}${yy}-${mm}-${dd}`;
    }

    const sex = line2[20];
    if (sex === 'M' || sex === 'F') result.sex = sex;

    const exp = line2.substring(21, 27);
    if (/^\d{6}$/.test(exp)) {
      const yy = parseInt(exp.substring(0, 2));
      const mm = exp.substring(2, 4);
      const dd = exp.substring(4, 6);
      const century = yy > 50 ? '19' : '20';
      result.expiry_date = `${century}${yy}-${mm}-${dd}`;
    }
  }

  return Object.keys(result).length > 2 ? result : null;
}

// Fallback: labeled field extraction from OCR text
function parseLabeled(text) {
  const result = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  // Passport number patterns
  const ppMatch = fullText.match(/(?:passport\s*(?:no|number|#)[:\s]*)?([A-Z]{1,2}\d{6,8})/i);
  if (ppMatch) result.passport_number = ppMatch[1];

  // Date patterns (YYYY-MM-DD, DD/MM/YYYY, DD MMM YYYY)
  const datePatterns = [
    /(\d{4}[-/]\d{2}[-/]\d{2})/,
    /(\d{2}[-/]\d{2}[-/]\d{4})/,
    /(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
  ];

  // Look for DOB
  const dobContext = fullText.match(/(?:date\s*of\s*birth|dob|born|birth\s*date)[:\s]*([\w\s\-\/]+?)(?:\s{2,}|\n|$)/i);
  if (dobContext) {
    for (const pat of datePatterns) {
      const m = dobContext[1].match(pat);
      if (m) { result.date_of_birth = m[1]; break; }
    }
  }

  // Expiry
  const expContext = fullText.match(/(?:expiry|expiration|exp\.?\s*date|valid\s*until)[:\s]*([\w\s\-\/]+?)(?:\s{2,}|\n|$)/i);
  if (expContext) {
    for (const pat of datePatterns) {
      const m = expContext[1].match(pat);
      if (m) { result.expiry_date = m[1]; break; }
    }
  }

  // Country
  const countryMatch = fullText.match(/(?:country|nationality|citizen)[:\s]*([A-Za-z\s]+?)(?:\s{2,}|\n|$)/i);
  if (countryMatch) result.nationality = countryMatch[1].trim();

  // Name
  const nameMatch = fullText.match(/(?:surname|family\s*name|last\s*name)[:\s]*([A-Za-z\s\-]+?)(?:\s{2,}|\n|$)/i);
  if (nameMatch) result.last_name = nameMatch[1].trim();

  const givenMatch = fullText.match(/(?:given\s*name|first\s*name|prenom)[:\s]*([A-Za-z\s\-]+?)(?:\s{2,}|\n|$)/i);
  if (givenMatch) result.first_name = givenMatch[1].trim();

  return Object.keys(result).length > 0 ? result : null;
}

// Country code to name mapping (common ones)
const COUNTRY_CODES = {
  CAN: 'Canada', USA: 'United States', GBR: 'United Kingdom', IND: 'India',
  CHN: 'China', PHL: 'Philippines', PAK: 'Pakistan', BGD: 'Bangladesh',
  NGA: 'Nigeria', BRA: 'Brazil', MEX: 'Mexico', FRA: 'France',
  DEU: 'Germany', KOR: 'South Korea', JPN: 'Japan', AUS: 'Australia',
  IRN: 'Iran', IRQ: 'Iraq', VNM: 'Vietnam', COL: 'Colombia',
  LKA: 'Sri Lanka', EGY: 'Egypt', NPL: 'Nepal', HKG: 'Hong Kong',
};

async function processPassport(filePath) {
  // Resolve file path
  let absPath = filePath;
  if (!path.isAbsolute(filePath)) {
    absPath = path.join(__dirname, '..', filePath);
  }

  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }

  // Run Tesseract OCR
  const { data } = await Tesseract.recognize(absPath, 'eng', {
    logger: () => {}, // suppress progress logs
  });

  const rawText = data.text;
  const confidence = data.confidence;

  // Try MRZ first (most reliable)
  let fields = parseMRZ(rawText);
  let method = 'mrz';

  // Fallback to labeled field extraction
  if (!fields || Object.keys(fields).length < 3) {
    fields = parseLabeled(rawText) || {};
    method = 'labeled';
  }

  // Expand country codes
  if (fields.country_of_issue && COUNTRY_CODES[fields.country_of_issue]) {
    fields.country_of_issue_full = COUNTRY_CODES[fields.country_of_issue];
  }
  if (fields.nationality && COUNTRY_CODES[fields.nationality]) {
    fields.nationality_full = COUNTRY_CODES[fields.nationality];
  }

  return {
    fields,
    raw_text: rawText,
    confidence,
    method,
  };
}

module.exports = { processPassport, parseMRZ, parseLabeled };
