const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { getSupportedVisaTypes, getFormsForVisaType, IRCC_FORMS, buildFormDataMap } = require('../services/irccFormTemplates');
const { analyzeFormFields, fillPDFForm } = require('../services/pdfFiller');

// Ensure uploads directory exists
const TEMPLATE_DIR = path.join(__dirname, '..', 'uploads', 'ircc-templates');
if (!fs.existsSync(TEMPLATE_DIR)) {
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMPLATE_DIR),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
        else cb(new Error('Only PDF files allowed'));
    }
});

// GET /api/ircc-templates — List all visa types with their forms
router.get('/', async (req, res) => {
    try {
        const visaTypes = getSupportedVisaTypes();
        const uploaded = await prepareAll('SELECT * FROM ircc_form_templates ORDER BY form_number');
        const uploadedMap = {};
        for (const u of uploaded) {
            uploadedMap[u.form_number] = u;
        }

        const result = visaTypes.map(vt => {
            const forms = getFormsForVisaType(vt);
            return {
                visaType: vt,
                forms: (forms || []).map(f => ({
                    ...f,
                    uploaded: !!uploadedMap[f.form_number],
                    uploadedInfo: uploadedMap[f.form_number] || null,
                }))
            };
        });

        // Stats
        const allForms = result.flatMap(r => r.forms);
        const uniqueForms = [...new Set(allForms.map(f => f.form_number || f.formNumber))];
        const uploadedCount = uniqueForms.filter(fn => uploadedMap[fn]).length;

        res.json({
            categories: result,
            stats: {
                totalCategories: visaTypes.length,
                totalForms: uniqueForms.length,
                uploadedForms: uploadedCount,
                pendingForms: uniqueForms.length - uploadedCount,
            }
        });
    } catch (err) {
        console.error('Error listing IRCC templates:', err);
        res.status(500).json({ error: 'Failed to list templates' });
    }
});

// Ensure filled forms directory exists
const FILLED_DIR = path.join(__dirname, '..', 'uploads', 'filled');
if (!fs.existsSync(FILLED_DIR)) {
    fs.mkdirSync(FILLED_DIR, { recursive: true });
}

// GET /api/ircc-templates/:formNumber/fields — Analyze form fields
router.get('/:formNumber/fields', async (req, res) => {
    try {
        const formNumber = decodeURIComponent(req.params.formNumber);
        const template = await prepareGet('SELECT * FROM ircc_form_templates WHERE form_number = ?', formNumber);
        if (!template || !fs.existsSync(template.file_path)) {
            return res.status(404).json({ error: 'Template not found' });
        }

        let fields = [];
        let formType = 'unknown';

        try {
            const analyzed = await analyzeFormFields(template.file_path);
            const genericNames = ['first_name', 'last_name', 'full_name', 'date_of_birth', 'nationality',
                'passport_number', 'email', 'phone', 'address', 'visa_type', 'marital_status',
                'sex', 'place_of_birth', 'occupation', 'country_of_residence'];
            const isGeneric = analyzed.length > 0 && analyzed.every(f => genericNames.includes(f.name));

            if (analyzed.length > 0 && !isGeneric) {
                formType = 'acroform';
                fields = analyzed.map(f => ({
                    name: f.name,
                    type: f.type || 'text',
                    label: formatFieldLabel(f.name),
                    options: f.options || null,
                }));
            }
        } catch (e) {
            console.warn('AcroForm analysis failed:', e.message);
        }

        // Fallback: use field_mappings from IRCC_FORMS
        if (fields.length === 0) {
            formType = 'xfa';
            const allMappings = {};
            for (const [vt, forms] of Object.entries(IRCC_FORMS)) {
                for (const form of forms) {
                    if (form.form_number === formNumber && form.field_mappings) {
                        for (const [pdfField, mapping] of Object.entries(form.field_mappings)) {
                            if (!allMappings[pdfField]) {
                                allMappings[pdfField] = typeof mapping === 'string' ? mapping : mapping.source;
                            }
                        }
                    }
                }
            }
            fields = Object.entries(allMappings).map(([pdfField, clientField]) => ({
                name: pdfField,
                type: 'text',
                label: formatFieldLabel(pdfField),
                clientField,
                options: null,
            }));
        }

        res.json({ form_number: formNumber, form_name: template.form_name, form_type: formType, fields });
    } catch (err) {
        console.error('Error analyzing form fields:', err);
        res.status(500).json({ error: 'Failed to analyze form fields' });
    }
});

/**
 * Build comprehensive client data map from all sources (client profile + PIF + client_data)
 */
async function buildFullClientDataMap(clientId) {
    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', clientId);
    if (!client) throw new Error('Client not found');

    const dataMap = {};
    if (client.first_name) dataMap['first_name'] = client.first_name;
    if (client.last_name) dataMap['last_name'] = client.last_name;
    dataMap['full_name'] = `${client.first_name || ''} ${client.last_name || ''}`.trim();
    if (client.email) dataMap['email'] = client.email;
    if (client.phone) dataMap['phone'] = client.phone;
    if (client.nationality) dataMap['nationality'] = client.nationality;
    if (client.date_of_birth) dataMap['date_of_birth'] = client.date_of_birth;
    if (client.passport_number) dataMap['passport_number'] = client.passport_number;
    if (client.visa_type) dataMap['visa_type'] = client.visa_type;

    // PIF data
    const pifSubmission = await prepareGet('SELECT form_data FROM pif_submissions WHERE client_id = ?', clientId);
    if (pifSubmission?.form_data) {
        try {
            const pifData = JSON.parse(pifSubmission.form_data);
            // PIF stores flat fields (firstName, lastName, dob, etc.)
            for (const [key, value] of Object.entries(pifData)) {
                if (value && typeof value === 'string' && value.trim()) {
                    dataMap[key] = value.trim();
                }
            }
        } catch {}
    }

    // Client data (from OCR / manual entries)
    const clientData = await prepareAll('SELECT field_key, field_value FROM client_data WHERE client_id = ?', clientId);
    for (const item of clientData) {
        if (item.field_value && item.field_value.trim()) {
            dataMap[item.field_key] = item.field_value;
        }
    }

    return { client, dataMap };
}

// PIF field key → standard field key mapping
const PIF_TO_STANDARD = {
    'firstName': 'first_name', 'lastName': 'last_name',
    'dob': 'date_of_birth', 'placeOfBirth': 'place_of_birth',
    'gender': 'sex', 'passportNumber': 'passport_number',
    'passportCountry': 'country_of_birth', 'maritalStatus': 'marital_status',
    'passportIssueDate': 'date_of_issue', 'passportExpiryDate': 'date_of_expiry',
};

// GET /api/ircc-templates/:formNumber/fields/:clientId — Fields pre-filled with client data
router.get('/:formNumber/fields/:clientId', async (req, res) => {
    try {
        const formNumber = decodeURIComponent(req.params.formNumber);
        const clientId = parseInt(req.params.clientId);

        const template = await prepareGet('SELECT * FROM ircc_form_templates WHERE form_number = ?', formNumber);
        if (!template || !fs.existsSync(template.file_path)) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Build field definitions (same as /fields endpoint)
        let fields = [];
        let formType = 'unknown';

        try {
            const analyzed = await analyzeFormFields(template.file_path);
            const genericNames = ['first_name', 'last_name', 'full_name', 'date_of_birth', 'nationality',
                'passport_number', 'email', 'phone', 'address', 'visa_type', 'marital_status',
                'sex', 'place_of_birth', 'occupation', 'country_of_residence'];
            const isGeneric = analyzed.length > 0 && analyzed.every(f => genericNames.includes(f.name));

            if (analyzed.length > 0 && !isGeneric) {
                formType = 'acroform';
                fields = analyzed.map(f => ({
                    name: f.name, type: f.type || 'text',
                    label: formatFieldLabel(f.name), options: f.options || null,
                }));
            }
        } catch (e) {
            console.warn('AcroForm analysis failed:', e.message);
        }

        if (fields.length === 0) {
            formType = 'xfa';
            const allMappings = {};
            for (const [vt, forms] of Object.entries(IRCC_FORMS)) {
                for (const form of forms) {
                    if (form.form_number === formNumber && form.field_mappings) {
                        for (const [pdfField, mapping] of Object.entries(form.field_mappings)) {
                            if (!allMappings[pdfField]) {
                                allMappings[pdfField] = typeof mapping === 'string' ? mapping : mapping.source;
                            }
                        }
                    }
                }
            }
            fields = Object.entries(allMappings).map(([pdfField, clientField]) => ({
                name: pdfField, type: 'text', label: formatFieldLabel(pdfField),
                clientField, options: null,
            }));
        }

        // Now get client data and pre-fill values
        const { client, dataMap } = await buildFullClientDataMap(clientId);

        // Normalize PIF keys to standard keys
        const normalizedDataMap = { ...dataMap };
        for (const [pifKey, stdKey] of Object.entries(PIF_TO_STANDARD)) {
            if (dataMap[pifKey] && !normalizedDataMap[stdKey]) {
                normalizedDataMap[stdKey] = dataMap[pifKey];
            }
        }

        // Find the form template to get field mappings for this form
        let formTemplate = null;
        const visaType = client.visa_type || 'Express Entry';
        const vtForms = IRCC_FORMS[visaType] || [];
        formTemplate = vtForms.find(f => f.form_number === formNumber);
        if (!formTemplate) {
            // Search all visa types
            for (const [vt, forms] of Object.entries(IRCC_FORMS)) {
                const found = forms.find(f => f.form_number === formNumber);
                if (found) { formTemplate = found; break; }
            }
        }

        // Build IRCC field → value mapping using buildFormDataMap
        let filledValues = {};
        if (formTemplate) {
            filledValues = buildFormDataMap(formTemplate, normalizedDataMap);
        }

        // Also do fuzzy matching for AcroForm fields
        for (const field of fields) {
            if (!filledValues[field.name] && field.clientField) {
                const v = normalizedDataMap[field.clientField];
                if (v) filledValues[field.name] = v;
            }
            // Direct match by field name
            if (!filledValues[field.name]) {
                const normalized = field.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                for (const [key, val] of Object.entries(normalizedDataMap)) {
                    if (key.toLowerCase().replace(/[^a-z0-9]/g, '_') === normalized && val) {
                        filledValues[field.name] = val;
                        break;
                    }
                }
            }
        }

        // Attach values to fields
        const enrichedFields = fields.map(f => ({
            ...f,
            value: filledValues[f.name] || '',
        }));

        res.json({
            form_number: formNumber,
            form_name: template.form_name,
            form_type: formType,
            client_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
            fields: enrichedFields,
        });
    } catch (err) {
        console.error('Error analyzing form fields for client:', err);
        res.status(500).json({ error: 'Failed to analyze form fields' });
    }
});

// GET /api/ircc-templates/:formNumber/view — Serve PDF inline for iframe
router.get('/:formNumber/view', async (req, res) => {
    try {
        const formNumber = decodeURIComponent(req.params.formNumber);
        const template = await prepareGet('SELECT * FROM ircc_form_templates WHERE form_number = ?', formNumber);
        if (!template || !fs.existsSync(template.file_path)) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${formNumber}.pdf"`);
        fs.createReadStream(template.file_path).pipe(res);
    } catch (err) {
        console.error('Error viewing template:', err);
        res.status(500).json({ error: 'Failed to view template' });
    }
});

// POST /api/ircc-templates/:formNumber/fill — Fill template with provided values
router.post('/:formNumber/fill', async (req, res) => {
    try {
        const formNumber = decodeURIComponent(req.params.formNumber);
        const template = await prepareGet('SELECT * FROM ircc_form_templates WHERE form_number = ?', formNumber);
        if (!template || !fs.existsSync(template.file_path)) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const { fields } = req.body;
        if (!fields || typeof fields !== 'object') {
            return res.status(400).json({ error: 'Missing fields object in request body' });
        }

        const dataMap = {};
        for (const [key, value] of Object.entries(fields)) {
            if (value && String(value).trim()) {
                dataMap[key] = String(value).trim();
            }
        }

        const outputFileName = `filled-${formNumber.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
        const outputPath = path.join(FILLED_DIR, outputFileName);
        await fillPDFForm(template.file_path, dataMap, outputPath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${formNumber} (Filled).pdf"`);
        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);
        fileStream.on('end', () => {
            try { fs.unlinkSync(outputPath); } catch (e) { /* ignore */ }
        });
    } catch (err) {
        console.error('Error filling template:', err);
        res.status(500).json({ error: 'Failed to fill template' });
    }
});

function formatFieldLabel(name) {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

// GET /api/ircc-templates/:visaType — Forms for specific visa type
router.get('/:visaType', async (req, res) => {
    try {
        const visaType = decodeURIComponent(req.params.visaType);
        const forms = getFormsForVisaType(visaType);
        if (!forms) return res.status(404).json({ error: 'Visa type not found' });

        const uploaded = await prepareAll('SELECT * FROM ircc_form_templates ORDER BY form_number');
        const uploadedMap = {};
        for (const u of uploaded) uploadedMap[u.form_number] = u;

        res.json({
            visaType,
            forms: forms.map(f => ({
                ...f,
                uploaded: !!uploadedMap[f.form_number],
                uploadedInfo: uploadedMap[f.form_number] || null,
            }))
        });
    } catch (err) {
        console.error('Error getting templates for visa type:', err);
        res.status(500).json({ error: 'Failed to get templates' });
    }
});

// POST /api/ircc-templates/:formNumber/upload — Upload PDF template
router.post('/:formNumber/upload', upload.single('file'), async (req, res) => {
    try {
        const formNumber = req.params.formNumber;
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        // Check if already uploaded — replace
        const existing = await prepareGet('SELECT * FROM ircc_form_templates WHERE form_number = ?', formNumber);
        if (existing) {
            // Delete old file
            if (fs.existsSync(existing.file_path)) fs.unlinkSync(existing.file_path);
            await prepareRun(
                'UPDATE ircc_form_templates SET file_path = ?, file_size = ?, form_name = ?, uploaded_at = NOW() WHERE form_number = ?',
                file.path, file.size, req.body.form_name || formNumber, formNumber
            );
        } else {
            await prepareRun(
                'INSERT INTO ircc_form_templates (form_number, form_name, visa_type, file_path, file_size) VALUES (?, ?, ?, ?, ?)',
                formNumber, req.body.form_name || formNumber, req.body.visa_type || '', file.path, file.size
            );
        }

        res.json({ success: true, message: 'Template uploaded' });
    } catch (err) {
        console.error('Error uploading template:', err);
        res.status(500).json({ error: 'Failed to upload template' });
    }
});

// GET /api/ircc-templates/:formNumber/download — Download stored template
router.get('/:formNumber/download', async (req, res) => {
    try {
        const template = await prepareGet('SELECT * FROM ircc_form_templates WHERE form_number = ?', req.params.formNumber);
        if (!template || !fs.existsSync(template.file_path)) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.download(template.file_path, `${template.form_number}.pdf`);
    } catch (err) {
        console.error('Error downloading template:', err);
        res.status(500).json({ error: 'Failed to download template' });
    }
});

// DELETE /api/ircc-templates/:formNumber — Remove uploaded template
router.delete('/:formNumber', async (req, res) => {
    try {
        const template = await prepareGet('SELECT * FROM ircc_form_templates WHERE form_number = ?', req.params.formNumber);
        if (!template) return res.status(404).json({ error: 'Template not found' });
        if (fs.existsSync(template.file_path)) fs.unlinkSync(template.file_path);
        await prepareRun('DELETE FROM ircc_form_templates WHERE form_number = ?', req.params.formNumber);
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});
module.exports = router;
