const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { getFormsForVisaType, getSupportedVisaTypes, buildFormDataMap } = require('../services/irccFormTemplates');
const { fillPDFForm, analyzeFormFields } = require('../services/pdfFiller');

// Multer setup for custom form uploads
const CUSTOM_FORMS_DIR = path.join(__dirname, '..', 'uploads', 'custom-forms');
if (!fs.existsSync(CUSTOM_FORMS_DIR)) fs.mkdirSync(CUSTOM_FORMS_DIR, { recursive: true });

const customFormUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CUSTOM_FORMS_DIR),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

/**
 * Build comprehensive client data map from all sources
 */
async function buildFullClientDataMap(clientId) {
  const client = await prepareGet('SELECT * FROM clients WHERE id = ?', clientId);
  if (!client) throw new Error('Client not found');

  const dataMap = {};

  // Core client fields
  if (client.first_name) dataMap['first_name'] = client.first_name;
  if (client.last_name) dataMap['last_name'] = client.last_name;
  dataMap['full_name'] = `${client.first_name || ''} ${client.last_name || ''}`.trim();
  if (client.email) dataMap['email'] = client.email;
  if (client.phone) dataMap['phone'] = client.phone;
  if (client.nationality) dataMap['nationality'] = client.nationality;
  if (client.date_of_birth) dataMap['date_of_birth'] = client.date_of_birth;
  if (client.passport_number) dataMap['passport_number'] = client.passport_number;
  if (client.visa_type) dataMap['visa_type'] = client.visa_type;

  // PIF data (flat object: { firstName, lastName, dob, ... })
  const pifSubmission = await prepareGet('SELECT form_data FROM pif_submissions WHERE client_id = ?', clientId);
  if (pifSubmission?.form_data) {
    try {
      const pifData = JSON.parse(pifSubmission.form_data);
      for (const [key, value] of Object.entries(pifData)) {
        if (value && typeof value === 'string' && value.trim()) {
          dataMap[key] = value.trim();
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Handle sectioned PIF data format { section: { field: value } }
          for (const [subKey, subVal] of Object.entries(value)) {
            if (subVal && typeof subVal === 'string' && subVal.trim()) {
              dataMap[subKey] = subVal.trim();
            }
          }
        }
      }

      // Also create standard field aliases from PIF camelCase keys
      const pifAliases = {
        firstName: 'first_name', lastName: 'last_name', dob: 'date_of_birth',
        placeOfBirth: 'place_of_birth', countryOfBirth: 'country_of_birth',
        nationality: 'nationality', countryOfResidence: 'country_of_residence',
        nativeLanguage: 'native_language',
        passportNumber: 'passport_number',
        passportIssueDate: 'date_of_issue', passportExpiryDate: 'date_of_expiry',
        passportCountry: 'passport_country', maritalStatus: 'marital_status',
        gender: 'sex', purposeOfVisit: 'purpose_of_visit',
        currentOccupation: 'occupation', currentEmployer: 'employer',
        highestEducation: 'education', intendedOccupation: 'intended_occupation',
        currentAddress: 'address', currentCity: 'city',
        currentProvince: 'province', currentPostalCode: 'postal_code',
        currentCountry: 'country',
        spouseFirstName: 'spouse_first_name', spouseLastName: 'spouse_last_name',
        spouseNationality: 'spouse_nationality', spousePassportNumber: 'spouse_passport_number',
        fatherFirstName: 'father_first_name', fatherLastName: 'father_last_name',
        motherFirstName: 'mother_first_name', motherLastName: 'mother_last_name',
        fatherCountryOfBirth: 'father_country_of_birth',
        motherCountryOfBirth: 'mother_country_of_birth',
        fatherNationality: 'father_nationality', motherNationality: 'mother_nationality',
        contactInCanadaName: 'contact_in_canada_name',
        contactInCanadaRelation: 'contact_in_canada_relation',
        contactInCanadaAddress: 'contact_in_canada_address',
      };
      for (const [pifKey, stdKey] of Object.entries(pifAliases)) {
        if (dataMap[pifKey] && !dataMap[stdKey]) {
          dataMap[stdKey] = dataMap[pifKey];
        }
      }
    } catch {}
  }

  // Client data (extracted from documents + manually added)
  const clientData = await prepareAll('SELECT field_key, field_value FROM client_data WHERE client_id = ?', clientId);
  for (const item of clientData) {
    if (item.field_value && item.field_value.trim()) {
      dataMap[item.field_key] = item.field_value;
      // Strip section prefix (e.g., "personal.given_name" → "given_name")
      if (item.field_key.includes('.')) {
        const bareKey = item.field_key.split('.').pop();
        if (!dataMap[bareKey]) {
          dataMap[bareKey] = item.field_value;
        }
      }
    }
  }

  // Map common bare keys to standard field names for XFA matching
  const bareAliases = {
    given_name: 'first_name', family_name: 'last_name',
    dob: 'date_of_birth', citizenship: 'nationality',
    street: 'address', postal_code: 'postal_code',
  };
  for (const [bare, std] of Object.entries(bareAliases)) {
    if (dataMap[bare] && !dataMap[std]) {
      dataMap[std] = dataMap[bare];
    }
  }

  return { client, dataMap };
}

// GET /ircc-forms/templates — list all supported visa types and their forms
router.get('/ircc-forms/templates', (req, res) => {
  const visaTypes = getSupportedVisaTypes();
  const templates = {};
  for (const vt of visaTypes) {
    templates[vt] = getFormsForVisaType(vt).map(f => ({
      form_number: f.form_number,
      name: f.name,
      category: f.category,
      field_count: Object.keys(f.field_mappings).length,
    }));
  }
  res.json({ visa_types: visaTypes, templates });
});

// GET /clients/:id/ircc-forms — get required IRCC forms for a client based on visa type
router.get('/clients/:id/ircc-forms', async (req, res) => {
  try {
    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const visaType = client.visa_type || 'Express Entry';
    const formTemplates = getFormsForVisaType(visaType);

    // Check which forms have already been generated (get the latest filled form per original_form_name)
    const existingFilled = await prepareAll(
      `SELECT DISTINCT ON (original_form_name) id, original_form_name
       FROM filled_forms WHERE client_id = $1
       ORDER BY original_form_name, filled_at DESC`,
      req.params.id
    );
    const filledMap = {};
    for (const f of existingFilled) {
      filledMap[f.original_form_name] = f.id;
    }

    const forms = formTemplates.map(f => {
      const formName = `${f.form_number} - ${f.name}.pdf`;
      const filledId = filledMap[formName];
      return {
        form_number: f.form_number,
        name: f.name,
        category: f.category,
        url: f.url,
        field_count: Object.keys(f.field_mappings).length,
        already_filled: !!filledId,
        filled_form_id: filledId || null,
        download_url: filledId ? `/api/filled-forms/${filledId}/download` : null,
      };
    });

    res.json({ visa_type: visaType, client_name: `${client.first_name} ${client.last_name}`, forms });
  } catch (err) {
    console.error('Error getting IRCC forms:', err);
    res.status(500).json({ error: 'Failed to get IRCC forms' });
  }
});

// POST /clients/:id/ircc-forms/generate — download IRCC form template, fill with client data, save
router.post('/clients/:id/ircc-forms/generate', async (req, res) => {
  try {
    const { form_number, force } = req.body;
    const clientId = parseInt(req.params.id);

    // Verification gate: check that PIF fields are verified before generating
    const isAdmin = req.user?.role === 'Admin';
    if (!force || !isAdmin) {
      const verificationCheck = await prepareAll(
        'SELECT field_key, verified FROM pif_field_verifications WHERE client_id = ?',
        clientId
      );
      const totalFields = await prepareGet(
        'SELECT COUNT(*) as total FROM pif_field_verifications WHERE client_id = ?',
        clientId
      );
      const unverifiedFields = verificationCheck.filter(v => !v.verified);
      if (unverifiedFields.length > 0 && verificationCheck.length > 0) {
        return res.status(400).json({
          error: 'verification_required',
          message: `${unverifiedFields.length} field(s) are not yet verified. Verify all PIF fields before generating forms.`,
          unverified_fields: unverifiedFields.map(f => f.field_key),
          total: verificationCheck.length,
          verified: verificationCheck.length - unverifiedFields.length,
        });
      }
    }

    const { client, dataMap } = await buildFullClientDataMap(clientId);
    const visaType = client.visa_type || 'Express Entry';
    const formTemplates = getFormsForVisaType(visaType);
    const template = formTemplates.find(f => f.form_number === form_number);

    if (!template) {
      return res.status(404).json({ error: `Form ${form_number} not found for visa type ${visaType}` });
    }

    // Build form-specific data using the template's field mappings
    const formDataMap = buildFormDataMap(template, dataMap);
    // Also include the raw data map for fuzzy matching in fillPDFForm
    const mergedDataMap = { ...dataMap, ...formDataMap };

    // Try to download the IRCC form PDF
    const formsDir = path.join(__dirname, '..', 'uploads', 'ircc-forms');
    if (!fs.existsSync(formsDir)) fs.mkdirSync(formsDir, { recursive: true });

    const templateFilename = `${template.form_number.replace(/\s+/g, '_')}.pdf`;
    const templatePath = path.join(formsDir, templateFilename);

    // Download if not cached
    if (!fs.existsSync(templatePath)) {
      try {
        console.log(`Downloading IRCC form: ${template.form_number} from ${template.url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(template.url, { signal: controller.signal, redirect: 'follow' });
        clearTimeout(timeout);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('pdf')) throw new Error(`Not a PDF (${response.status}, ${contentType})`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(templatePath, buffer);
        console.log(`Downloaded and cached: ${templateFilename}`);
      } catch (downloadErr) {
        console.error(`Could not download ${template.form_number}:`, downloadErr.message);
        // Generate a summary PDF instead
        return await generateSummaryPDF(res, template, mergedDataMap, clientId, client);
      }
    }

    // Fill the downloaded form
    const filledDir = path.join(__dirname, '..', 'uploads', 'filled');
    if (!fs.existsSync(filledDir)) fs.mkdirSync(filledDir, { recursive: true });
    const filledFilename = `filled_${uuidv4()}.pdf`;
    const filledPath = path.join(filledDir, filledFilename);

    const fillResult = await fillPDFForm(templatePath, mergedDataMap, filledPath);

    // Save to filled_forms table
    // First check if we have a forms entry for this template
    let formId;
    const existingForm = await prepareGet(
      'SELECT id FROM forms WHERE client_id = ? AND form_name = ?',
      clientId, `${template.form_number} - ${template.name}`
    );

    if (existingForm) {
      formId = existingForm.id;
    } else {
      const formResult = await prepareRun(
        `INSERT INTO forms (client_id, filename, original_name, file_path, form_name, field_count, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        clientId, templateFilename, `${template.form_number} - ${template.name}.pdf`,
        templatePath, `${template.form_number} - ${template.name}`,
        Object.keys(template.field_mappings).length, '[]'
      );
      formId = formResult.lastInsertRowid;
    }

    const insertResult = await prepareRun(
      `INSERT INTO filled_forms (form_id, client_id, file_path, original_form_name) VALUES (?, ?, ?, ?)`,
      formId, clientId, filledPath, `${template.form_number} - ${template.name}.pdf`
    );

    // Store the data map used for filling
    await prepareRun('UPDATE filled_forms SET data_map_json = ? WHERE id = ?', JSON.stringify(mergedDataMap), insertResult.lastInsertRowid);

    const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', insertResult.lastInsertRowid);

    res.json({
      ...filledForm,
      form_number: template.form_number,
      form_name: template.name,
      fields_filled: fillResult.fieldsFilled,
      fields_total: fillResult.fieldsTotal,
      download_url: `/api/filled-forms/${filledForm.id}/download`,
    });
  } catch (err) {
    console.error('Error generating IRCC form:', err);
    res.status(500).json({ error: 'Failed to generate form: ' + err.message });
  }
});

// POST /clients/:id/ircc-forms/generate-all — generate all required forms for a client
router.post('/clients/:id/ircc-forms/generate-all', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const { force } = req.body || {};

    // Verification gate
    const isAdmin = req.user?.role === 'Admin';
    if (!force || !isAdmin) {
      const verificationCheck = await prepareAll(
        'SELECT field_key, verified FROM pif_field_verifications WHERE client_id = ?',
        clientId
      );
      const unverifiedFields = verificationCheck.filter(v => !v.verified);
      if (unverifiedFields.length > 0 && verificationCheck.length > 0) {
        return res.status(400).json({
          error: 'verification_required',
          message: `${unverifiedFields.length} field(s) are not yet verified. Verify all PIF fields before generating forms.`,
          unverified_fields: unverifiedFields.map(f => f.field_key),
          total: verificationCheck.length,
          verified: verificationCheck.length - unverifiedFields.length,
        });
      }
    }

    const { client, dataMap } = await buildFullClientDataMap(clientId);
    const visaType = client.visa_type || 'Express Entry';
    const formTemplates = getFormsForVisaType(visaType);

    const results = [];
    const formsDir = path.join(__dirname, '..', 'uploads', 'ircc-forms');
    const filledDir = path.join(__dirname, '..', 'uploads', 'filled');
    if (!fs.existsSync(formsDir)) fs.mkdirSync(formsDir, { recursive: true });
    if (!fs.existsSync(filledDir)) fs.mkdirSync(filledDir, { recursive: true });

    for (const template of formTemplates) {
      try {
        const formDataMap = buildFormDataMap(template, dataMap);
        const mergedDataMap = { ...dataMap, ...formDataMap };

        const templateFilename = `${template.form_number.replace(/\s+/g, '_')}.pdf`;
        const templatePath = path.join(formsDir, templateFilename);

        // Download if not cached
        if (!fs.existsSync(templatePath)) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(template.url, { signal: controller.signal, redirect: 'follow' });
            clearTimeout(timeout);
            const contentType = response.headers.get('content-type') || '';
            if (!response.ok || !contentType.includes('pdf')) throw new Error(`Not a PDF (${response.status}, ${contentType})`);
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(templatePath, buffer);
          } catch {
            // Generate summary PDF as fallback
            const summaryResult = await createSummaryPDF(template, mergedDataMap, clientId, client);
            results.push(summaryResult);
            continue;
          }
        }

        const filledFilename = `filled_${uuidv4()}.pdf`;
        const filledPath = path.join(filledDir, filledFilename);
        const fillResult = await fillPDFForm(templatePath, mergedDataMap, filledPath);

        let formId;
        const existingForm = await prepareGet(
          'SELECT id FROM forms WHERE client_id = ? AND form_name = ?',
          clientId, `${template.form_number} - ${template.name}`
        );
        if (existingForm) {
          formId = existingForm.id;
        } else {
          const formResult = await prepareRun(
            `INSERT INTO forms (client_id, filename, original_name, file_path, form_name, field_count, fields_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            clientId, templateFilename, `${template.form_number} - ${template.name}.pdf`,
            templatePath, `${template.form_number} - ${template.name}`,
            Object.keys(template.field_mappings).length, '[]'
          );
          formId = formResult.lastInsertRowid;
        }

        const insertResult = await prepareRun(
          `INSERT INTO filled_forms (form_id, client_id, file_path, original_form_name) VALUES (?, ?, ?, ?)`,
          formId, clientId, filledPath, `${template.form_number} - ${template.name}.pdf`
        );

        await prepareRun('UPDATE filled_forms SET data_map_json = ? WHERE id = ?', JSON.stringify(mergedDataMap), insertResult.lastInsertRowid);

        const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', insertResult.lastInsertRowid);
        results.push({
          ...filledForm,
          form_number: template.form_number,
          form_name: template.name,
          fields_filled: fillResult.fieldsFilled,
          fields_total: fillResult.fieldsTotal,
          download_url: `/api/filled-forms/${filledForm.id}/download`,
        });
      } catch (e) {
        results.push({
          form_number: template.form_number,
          name: template.name,
          error: e.message,
        });
      }
    }

    res.json({
      visa_type: visaType,
      client_name: `${client.first_name} ${client.last_name}`,
      total: formTemplates.length,
      generated: results.filter(r => !r.error).length,
      results,
    });
  } catch (err) {
    console.error('Error generating all IRCC forms:', err);
    res.status(500).json({ error: 'Failed to generate forms' });
  }
});

// GET /ircc-forms/filled/:filledFormId/data — get editable field data for a filled form
router.get('/ircc-forms/filled/:filledFormId/data', async (req, res) => {
  try {
    const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', req.params.filledFormId);
    if (!filledForm) return res.status(404).json({ error: 'Filled form not found' });

    // Parse stored data map if available
    let dataMap = {};
    if (filledForm.data_map_json) {
      try { dataMap = JSON.parse(filledForm.data_map_json); } catch {}
    }

    // Find the matching IRCC template
    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', filledForm.client_id);
    const visaType = client?.visa_type || 'Express Entry';
    const formTemplates = getFormsForVisaType(visaType);

    // Match by original_form_name
    const formName = filledForm.original_form_name?.replace(/\.pdf$/i, '') || '';
    const template = formTemplates.find(f => `${f.form_number} - ${f.name}` === formName);

    // Build field list with current values
    const fields = [];
    if (template) {
      for (const [pdfField, mapping] of Object.entries(template.field_mappings)) {
        const dataKey = typeof mapping === 'string' ? mapping : mapping.source;
        fields.push({
          pdf_field: pdfField,
          data_key: dataKey,
          value: dataMap[pdfField] || dataMap[dataKey] || '',
          label: dataKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        });
      }
    } else {
      // No template match — show raw data map keys
      for (const [key, value] of Object.entries(dataMap)) {
        if (value && typeof value === 'string') {
          fields.push({
            pdf_field: key,
            data_key: key,
            value,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          });
        }
      }
    }

    res.json({
      filled_form_id: filledForm.id,
      form_name: formName,
      form_number: template?.form_number || '',
      client_id: filledForm.client_id,
      filled_at: filledForm.filled_at,
      download_url: `/api/filled-forms/${filledForm.id}/download`,
      fields,
    });
  } catch (err) {
    console.error('Error getting filled form data:', err);
    res.status(500).json({ error: 'Failed to get form data' });
  }
});

// PUT /ircc-forms/filled/:filledFormId/data — update fields and regenerate PDF
router.put('/ircc-forms/filled/:filledFormId/data', async (req, res) => {
  try {
    const { fields } = req.body; // { "FamilyName": "Smith", "GivenName": "John", ... }
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'fields object required' });
    }

    const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', req.params.filledFormId);
    if (!filledForm) return res.status(404).json({ error: 'Filled form not found' });

    const clientId = filledForm.client_id;

    // Build base data map from client
    const { client, dataMap } = await buildFullClientDataMap(clientId);
    const visaType = client.visa_type || 'Express Entry';
    const formTemplates = getFormsForVisaType(visaType);

    const formName = filledForm.original_form_name?.replace(/\.pdf$/i, '') || '';
    const template = formTemplates.find(f => `${f.form_number} - ${f.name}` === formName);

    // Merge user edits on top
    const mergedDataMap = { ...dataMap };
    if (template) {
      const formDataMap = buildFormDataMap(template, dataMap);
      Object.assign(mergedDataMap, formDataMap);
    }
    Object.assign(mergedDataMap, fields);

    if (!template) {
      return res.status(400).json({ error: 'No matching template found for this form' });
    }

    // Re-fill the PDF
    const formsDir = path.join(__dirname, '..', 'uploads', 'ircc-forms');
    const filledDir = path.join(__dirname, '..', 'uploads', 'filled');
    if (!fs.existsSync(filledDir)) fs.mkdirSync(filledDir, { recursive: true });

    const templateFilename = `${template.form_number.replace(/\s+/g, '_')}.pdf`;
    const templatePath = path.join(formsDir, templateFilename);

    let newFilledPath, fillResult;
    let usedSummary = false;

    // Try to use cached or downloaded IRCC template
    let hasTemplate = fs.existsSync(templatePath);
    if (!hasTemplate) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(template.url, { signal: controller.signal, redirect: 'follow' });
        clearTimeout(timeout);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('pdf')) throw new Error(`Not a PDF`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!fs.existsSync(formsDir)) fs.mkdirSync(formsDir, { recursive: true });
        fs.writeFileSync(templatePath, buffer);
        hasTemplate = true;
      } catch {
        hasTemplate = false;
      }
    }

    // Delete old filled file
    if (filledForm.file_path && fs.existsSync(filledForm.file_path)) {
      try { fs.unlinkSync(filledForm.file_path); } catch {}
    }

    if (hasTemplate) {
      const newFilledFilename = `filled_${uuidv4()}.pdf`;
      newFilledPath = path.join(filledDir, newFilledFilename);
      fillResult = await fillPDFForm(templatePath, mergedDataMap, newFilledPath);
    } else {
      // Generate summary PDF with the edited data
      const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let page = pdfDoc.addPage([612, 792]);
      let y = 740;
      page.drawText(`${template.form_number} — ${template.name}`, { x: 50, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.4) });
      y -= 25;
      page.drawText(`Client: ${client.first_name} ${client.last_name}`, { x: 50, y, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 15;
      page.drawText(`Visa Type: ${client.visa_type || 'N/A'} | Updated: ${new Date().toLocaleString()}`, { x: 50, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
      y -= 30;
      page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
      y -= 25;
      page.drawText('PRE-FILLED DATA FOR THIS FORM:', { x: 50, y, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      y -= 25;
      const formDataMap = buildFormDataMap(template, mergedDataMap);
      for (const [field, value] of Object.entries(formDataMap)) {
        if (y < 80) { page = pdfDoc.addPage([612, 792]); y = 740; }
        if (value) {
          page.drawText(`${field}:`, { x: 60, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
          page.drawText(String(value).substring(0, 60), { x: 220, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
          y -= 18;
        }
      }
      const newFilledFilename = `filled_${uuidv4()}.pdf`;
      newFilledPath = path.join(filledDir, newFilledFilename);
      fs.writeFileSync(newFilledPath, await pdfDoc.save());
      fillResult = { fieldsFilled: Object.values(formDataMap).filter(v => v).length, fieldsTotal: Object.keys(template.field_mappings).length };
      usedSummary = true;
    }

    // Update record
    await prepareRun(
      `UPDATE filled_forms SET file_path = ?, data_map_json = ?, filled_at = NOW() WHERE id = ?`,
      newFilledPath, JSON.stringify(mergedDataMap), filledForm.id
    );

    const updated = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', filledForm.id);
    res.json({
      ...updated,
      form_number: template.form_number,
      form_name: template.name,
      fields_filled: fillResult.fieldsFilled,
      fields_total: fillResult.fieldsTotal,
      download_url: `/api/filled-forms/${filledForm.id}/download`,
      ...(usedSummary ? { note: 'Updated summary PDF (official form template unavailable)' } : {}),
    });
  } catch (err) {
    console.error('Error updating filled form:', err);
    res.status(500).json({ error: 'Failed to update form: ' + err.message });
  }
});

/**
 * Create a summary PDF when the IRCC form can't be downloaded.
 * Returns the result object (does not send response).
 */
async function createSummaryPDF(template, dataMap, clientId, client) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const filledDir = path.join(__dirname, '..', 'uploads', 'filled');
  if (!fs.existsSync(filledDir)) fs.mkdirSync(filledDir, { recursive: true });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([612, 792]);

  let y = 740;
  page.drawText(`${template.form_number} — ${template.name}`, {
    x: 50, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.4)
  });
  y -= 25;
  page.drawText(`Client: ${client.first_name} ${client.last_name}`, {
    x: 50, y, size: 12, font, color: rgb(0.3, 0.3, 0.3)
  });
  y -= 15;
  page.drawText(`Visa Type: ${client.visa_type || 'N/A'} | Generated: ${new Date().toLocaleString()}`, {
    x: 50, y, size: 10, font, color: rgb(0.5, 0.5, 0.5)
  });
  y -= 30;

  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 25;

  page.drawText('PRE-FILLED DATA FOR THIS FORM:', {
    x: 50, y, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.2)
  });
  y -= 25;

  const formDataMap = buildFormDataMap(template, dataMap);
  for (const [field, value] of Object.entries(formDataMap)) {
    if (y < 80) {
      page = pdfDoc.addPage([612, 792]);
      y = 740;
    }
    if (value) {
      page.drawText(`${field}:`, { x: 60, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(String(value).substring(0, 60), { x: 220, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    }
  }

  y -= 20;
  page.drawText('Note: Could not download the official IRCC form template.', {
    x: 50, y, size: 9, font, color: rgb(0.6, 0.3, 0.3)
  });
  y -= 14;
  page.drawText(`Download it manually from: ${template.url}`, {
    x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4)
  });

  const filledFilename = `filled_${uuidv4()}.pdf`;
  const filledPath = path.join(filledDir, filledFilename);
  const savedBytes = await pdfDoc.save();
  fs.writeFileSync(filledPath, savedBytes);

  // Save to DB
  let formId;
  const existingForm = await prepareGet(
    'SELECT id FROM forms WHERE client_id = ? AND form_name = ?',
    clientId, `${template.form_number} - ${template.name}`
  );
  if (existingForm) {
    formId = existingForm.id;
  } else {
    const formResult = await prepareRun(
      `INSERT INTO forms (client_id, filename, original_name, file_path, form_name, field_count, fields_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      clientId, filledFilename, `${template.form_number} - ${template.name}.pdf`,
      filledPath, `${template.form_number} - ${template.name}`,
      Object.keys(template.field_mappings).length, '[]'
    );
    formId = formResult.lastInsertRowid;
  }

  const insertResult = await prepareRun(
    `INSERT INTO filled_forms (form_id, client_id, file_path, original_form_name) VALUES (?, ?, ?, ?)`,
    formId, clientId, filledPath, `${template.form_number} - ${template.name}.pdf`
  );

  await prepareRun('UPDATE filled_forms SET data_map_json = ? WHERE id = ?', JSON.stringify(dataMap), insertResult.lastInsertRowid);

  const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', insertResult.lastInsertRowid);
  return {
    ...filledForm,
    form_number: template.form_number,
    form_name: template.name,
    fields_filled: Object.values(formDataMap).filter(v => v).length,
    fields_total: Object.keys(template.field_mappings).length,
    download_url: `/api/filled-forms/${filledForm.id}/download`,
    note: 'Generated summary PDF (official form template unavailable)',
  };
}

/**
 * Fallback: generate a summary PDF and send response
 */
async function generateSummaryPDF(res, template, dataMap, clientId, client) {
  const result = await createSummaryPDF(template, dataMap, clientId, client);
  res.json(result);
}

// POST /clients/:id/ircc-forms/upload-and-fill — Upload a blank IRCC form and auto-fill with PIF data
router.post('/clients/:id/ircc-forms/upload-and-fill', customFormUpload.single('form'), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    const templatePath = req.file.path;
    const originalName = req.file.originalname;
    const formLabel = req.body.form_name || originalName.replace(/\.pdf$/i, '');

    // Build client data map
    const { client, dataMap } = await buildFullClientDataMap(clientId);

    // Also build form-specific data if we recognise the form
    const visaType = client.visa_type || 'Express Entry';
    const formTemplates = getFormsForVisaType(visaType);
    let mergedDataMap = { ...dataMap };

    // Try to match uploaded form to a known IRCC template by filename
    for (const t of formTemplates) {
      const tName = t.form_number.toLowerCase().replace(/\s+/g, '');
      const uName = originalName.toLowerCase().replace(/\s+/g, '').replace(/\.pdf$/i, '');
      if (uName.includes(tName) || tName.includes(uName)) {
        const mapped = buildFormDataMap(t, dataMap);
        mergedDataMap = { ...mergedDataMap, ...mapped };
        break;
      }
    }

    // Fill the uploaded form
    const filledDir = path.join(__dirname, '..', 'uploads', 'filled');
    if (!fs.existsSync(filledDir)) fs.mkdirSync(filledDir, { recursive: true });
    const filledFilename = `filled_${uuidv4()}.pdf`;
    const filledPath = path.join(filledDir, filledFilename);

    const fillResult = await fillPDFForm(templatePath, mergedDataMap, filledPath);

    // Save custom form template record
    let formId;
    const existingForm = await prepareGet(
      'SELECT id FROM forms WHERE client_id = ? AND form_name = ?',
      clientId, formLabel
    );
    if (existingForm) {
      formId = existingForm.id;
    } else {
      const formResult = await prepareRun(
        `INSERT INTO forms (client_id, filename, original_name, file_path, form_name, field_count, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        clientId, req.file.filename, originalName,
        templatePath, formLabel,
        fillResult.fieldsTotal || 0, '[]'
      );
      formId = formResult.lastInsertRowid;
    }

    // Save filled form record
    const insertResult = await prepareRun(
      `INSERT INTO filled_forms (form_id, client_id, file_path, original_form_name) VALUES (?, ?, ?, ?)`,
      formId, clientId, filledPath, `${formLabel}.pdf`
    );
    await prepareRun('UPDATE filled_forms SET data_map_json = ? WHERE id = ?',
      JSON.stringify(mergedDataMap), insertResult.lastInsertRowid
    );

    const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', insertResult.lastInsertRowid);

    res.json({
      ...filledForm,
      form_name: formLabel,
      fields_filled: fillResult.fieldsFilled,
      fields_total: fillResult.fieldsTotal,
      method: fillResult.method || 'acroform',
      xfa_fields_found: fillResult.xfaFieldsFound || [],
      download_url: `/api/filled-forms/${filledForm.id}/download`,
      message: `Form "${formLabel}" auto-filled with ${fillResult.fieldsFilled} of ${fillResult.fieldsTotal} fields using PIF data`,
    });
  } catch (err) {
    console.error('Error in upload-and-fill:', err);
    res.status(500).json({ error: 'Failed to fill uploaded form: ' + err.message });
  }
});

// GET /clients/:id/ircc-forms/custom — list custom uploaded + filled forms for a client
router.get('/clients/:id/ircc-forms/custom', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const filled = await prepareAll(
      `SELECT ff.*, f.form_name, f.original_name, f.file_path as template_path
       FROM filled_forms ff
       LEFT JOIN forms f ON ff.form_id = f.id
       WHERE ff.client_id = $1
       ORDER BY ff.filled_at DESC`,
      clientId
    );
    res.json({
      forms: filled.map(f => ({
        ...f,
        download_url: `/api/filled-forms/${f.id}/download`,
      }))
    });
  } catch (err) {
    console.error('Error listing custom forms:', err);
    res.status(500).json({ error: 'Failed to list forms' });
  }
});

module.exports = router;
