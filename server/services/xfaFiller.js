/**
 * xfaFiller.js — XFA (XML Forms Architecture) PDF form filler
 *
 * Delegates XFA filling to xfa_fill.py (Python/pikepdf) because pdf-lib
 * cannot parse Object Streams (ObjStm) used by IRCC XFA PDFs.
 *
 * Exports:
 *  - fillXfaForm(templatePath, dataMap, outputPath)
 *  - isXfaForm(templatePath)
 *  - getXfaFieldNames(templatePath)
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const XFA_FILL_SCRIPT = path.join(__dirname, 'xfa_fill.py');

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Run xfa_fill.py and return parsed JSON result.
 */
function runPython(args) {
  return new Promise((resolve, reject) => {
    execFile('python', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (stderr) console.warn('[xfa_fill.py stderr]', stderr.trim());

      if (err) {
        // Try to parse JSON error from stdout even on non-zero exit
        try {
          const result = JSON.parse(stdout);
          if (result.error) return reject(new Error(result.error));
        } catch {}
        return reject(new Error(`xfa_fill.py failed: ${err.message}`));
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (parseErr) {
        reject(new Error(`xfa_fill.py returned invalid JSON: ${stdout.substring(0, 200)}`));
      }
    });
  });
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Check if a PDF file is an XFA form by looking for NeedsRendering
 * or XFA key in the raw bytes (fast heuristic, no pdf-lib needed).
 */
async function isXfaForm(templatePath) {
  try {
    const buf = fs.readFileSync(templatePath);
    const text = buf.toString('latin1'); // safe for scanning PDF tokens
    return text.includes('/NeedsRendering') || text.includes('/XFA');
  } catch {
    return false;
  }
}

/**
 * Fill an XFA-based PDF form using Python/pikepdf.
 *
 * @param {string} templatePath - Path to the blank IRCC form PDF
 * @param {Object} dataMap      - { FieldName: 'value', ... } mapping
 * @param {string} outputPath   - Where to write the filled PDF
 * @returns {{ success, fieldsFilled, fieldsTotal, filledFields, method }}
 */
async function fillXfaForm(templatePath, dataMap, outputPath) {
  // Write data map to a temp JSON file
  const tmpJson = path.join(os.tmpdir(), `xfa_data_${Date.now()}.json`);

  try {
    fs.writeFileSync(tmpJson, JSON.stringify(dataMap, null, 2), 'utf-8');

    console.log(`[XFA] Calling xfa_fill.py:`);
    console.log(`  Template: ${templatePath}`);
    console.log(`  Data keys: ${Object.keys(dataMap).length}`);
    console.log(`  Output: ${outputPath}`);

    const result = await runPython([XFA_FILL_SCRIPT, templatePath, tmpJson, outputPath]);

    if (result.success) {
      console.log(`[XFA] Success: ${result.fieldsFilled}/${result.fieldsTotal} fields filled`);
      console.log(`[XFA] Filled: ${(result.filledFields || []).join(', ')}`);
    } else {
      console.warn('[XFA] Script returned failure:', result.error);
    }

    return {
      success: result.success || false,
      fieldsFilled: result.fieldsFilled || 0,
      fieldsTotal: result.fieldsTotal || 0,
      xfaFieldsFound: result.filledFields || [],
      method: result.method || 'xfa-pikepdf',
    };
  } catch (err) {
    console.error('[XFA] fillXfaForm error:', err.message);
    return {
      success: false,
      fieldsFilled: 0,
      fieldsTotal: 0,
      error: err.message,
    };
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpJson); } catch {}
  }
}

/**
 * Extract field names from an XFA form using Python/pikepdf.
 * Falls back to scanning the raw PDF bytes for element names.
 */
async function getXfaFieldNames(templatePath) {
  try {
    // Quick extraction: read the PDF bytes and scan for XFA datasets XML elements
    const buf = fs.readFileSync(templatePath);
    const text = buf.toString('latin1');

    const fields = [];
    const seen = new Set();

    // Structural tags to skip
    const skip = new Set([
      'xfa:datasets', 'xfa:data', 'form1', 'LOVFile', 'LOV',
      'Header', 'Footer', 'Barcodes', 'ReaderInfo', 'Disclosure',
      'SectionHeader', 'SectionA', 'SectionB', 'SectionC',
    ]);

    // Find self-closing XML elements (typical of unfilled XFA fields)
    const selfRe = /<([A-Za-z][A-Za-z0-9_]*)\s*\/>/g;
    let m;
    while ((m = selfRe.exec(text)) !== null) {
      const name = m[1];
      if (!seen.has(name) && !skip.has(name) && !name.includes(':') && !name.startsWith('Page')) {
        fields.push({ name, type: 'text', source: 'xfa-datasets' });
        seen.add(name);
      }
    }

    return fields;
  } catch (err) {
    console.warn('[XFA] getXfaFieldNames error:', err.message);
    return [];
  }
}

module.exports = { fillXfaForm, isXfaForm, getXfaFieldNames };
