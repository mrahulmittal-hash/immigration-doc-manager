const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { analyzeFormFields, fillPDFForm } = require('../services/pdfFiller');
const { extractTextFromPDF } = require('../services/pdfParser');

/**
 * Auto-extract data from all client documents and merge into client_data.
 */
async function autoExtractAndBuildDataMap(clientId) {
    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', clientId);
    if (!client) throw new Error('Client not found');

    const docs = await prepareAll('SELECT * FROM documents WHERE client_id = ?', clientId);
    const mergedExtracted = {};

    for (const doc of docs) {
        if (!doc.original_name.toLowerCase().endsWith('.pdf')) continue;
        if (!fs.existsSync(doc.file_path)) continue;

        try {
            const extracted = await extractTextFromPDF(doc.file_path);
            if (!extracted.isImageOnly && extracted.data) {
                for (const [key, value] of Object.entries(extracted.data)) {
                    if (!mergedExtracted[key] || value.length > (mergedExtracted[key] || '').length) {
                        mergedExtracted[key] = value;
                    }
                }
            }
        } catch (e) {
            console.warn('Extraction failed for', doc.original_name, ':', e.message);
        }
    }

    // Store extracted data (without overwriting manual entries)
    for (const [key, value] of Object.entries(mergedExtracted)) {
        if (value && value.toString().trim()) {
            const existing = await prepareGet(
                'SELECT * FROM client_data WHERE client_id = ? AND field_key = ? AND source = ?',
                clientId, key, 'manual'
            );
            if (!existing) {
                await prepareRun('DELETE FROM client_data WHERE client_id = ? AND field_key = ? AND source = ?',
                    clientId, key, 'extracted');
                await prepareRun('INSERT INTO client_data (client_id, field_key, field_value, source) VALUES (?, ?, ?, ?)',
                    clientId, key, value.toString().trim(), 'extracted');
            }
        }
    }

    // Build complete data map
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

    const clientData = await prepareAll('SELECT field_key, field_value FROM client_data WHERE client_id = ?', clientId);
    for (const item of clientData) {
        dataMap[item.field_key] = item.field_value || '';
    }

    return dataMap;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'forms');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for forms'));
        }
    }
});

// POST /api/clients/:clientId/forms
router.post('/clients/:clientId/forms', upload.array('files', 10), async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const client = await prepareGet('SELECT id FROM clients WHERE id = ?', clientId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const formName = req.body.form_name || '';
        const forms = [];

        for (const file of req.files) {
            let fields = [];
            let fieldCount = 0;
            try {
                fields = await analyzeFormFields(file.path);
                fieldCount = fields.length;
            } catch (e) {
                console.warn('Could not analyze form fields:', e.message);
            }

            const result = await prepareRun(
                `INSERT INTO forms (client_id, filename, original_name, file_path, form_name, field_count, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                clientId, file.filename, file.originalname, file.path,
                formName || file.originalname, fieldCount, JSON.stringify(fields)
            );
            const form = await prepareGet('SELECT * FROM forms WHERE id = ?', result.lastInsertRowid);
            forms.push({ ...form, fields });
        }

        res.status(201).json(forms);
    } catch (err) {
        console.error('Error uploading forms:', err);
        res.status(500).json({ error: 'Failed to upload forms' });
    }
});

// GET /api/clients/:clientId/forms
router.get('/clients/:clientId/forms', async (req, res) => {
    try {
        const forms = await prepareAll('SELECT * FROM forms WHERE client_id = ? ORDER BY uploaded_at DESC', parseInt(req.params.clientId));
        const enriched = forms.map(f => ({
            ...f,
            fields: f.fields_json ? JSON.parse(f.fields_json) : []
        }));
        res.json(enriched);
    } catch (err) {
        console.error('Error listing forms:', err);
        res.status(500).json({ error: 'Failed to list forms' });
    }
});

// GET /api/forms/:id/fields
router.get('/forms/:id/fields', async (req, res) => {
    try {
        const form = await prepareGet('SELECT * FROM forms WHERE id = ?', parseInt(req.params.id));
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }

        let fields = form.fields_json ? JSON.parse(form.fields_json) : [];
        if (fields.length === 0) {
            try {
                fields = await analyzeFormFields(form.file_path);
                await prepareRun('UPDATE forms SET field_count = ?, fields_json = ? WHERE id = ?',
                    fields.length, JSON.stringify(fields), form.id);
            } catch (e) {
                console.warn('Could not analyze form fields:', e.message);
            }
        }

        res.json({ form_id: form.id, form_name: form.form_name, fields });
    } catch (err) {
        console.error('Error getting form fields:', err);
        res.status(500).json({ error: 'Failed to get form fields' });
    }
});

// POST /api/forms/:id/fill
router.post('/forms/:id/fill', async (req, res) => {
    try {
        const form = await prepareGet('SELECT * FROM forms WHERE id = ?', parseInt(req.params.id));
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const dataMap = await autoExtractAndBuildDataMap(form.client_id);

        if (req.body.mappings) {
            for (const [key, value] of Object.entries(req.body.mappings)) {
                dataMap[key] = value;
            }
        }

        const filledDir = path.join(__dirname, '..', 'uploads', 'filled');
        if (!fs.existsSync(filledDir)) fs.mkdirSync(filledDir, { recursive: true });
        const filledFilename = `filled_${uuidv4()}.pdf`;
        const filledPath = path.join(filledDir, filledFilename);

        const result = await fillPDFForm(form.file_path, dataMap, filledPath);

        const insertResult = await prepareRun(
            `INSERT INTO filled_forms (form_id, client_id, file_path, original_form_name) VALUES (?, ?, ?, ?)`,
            form.id, form.client_id, filledPath, form.original_name
        );

        const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', insertResult.lastInsertRowid);

        res.json({
            ...filledForm,
            fields_filled: result.fieldsFilled,
            fields_total: result.fieldsTotal,
            download_url: `/api/filled-forms/${filledForm.id}/download`
        });
    } catch (err) {
        console.error('Error filling form:', err);
        res.status(500).json({ error: 'Failed to fill form: ' + err.message });
    }
});

// POST /api/clients/:clientId/forms/fill-all
router.post('/clients/:clientId/forms/fill-all', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const forms = await prepareAll('SELECT * FROM forms WHERE client_id = ?', clientId);
        if (forms.length === 0) {
            return res.status(400).json({ error: 'No forms uploaded for this client' });
        }

        const dataMap = await autoExtractAndBuildDataMap(clientId);

        const results = [];
        const filledDir = path.join(__dirname, '..', 'uploads', 'filled');
        if (!fs.existsSync(filledDir)) fs.mkdirSync(filledDir, { recursive: true });

        for (const form of forms) {
            try {
                const filledFilename = `filled_${uuidv4()}.pdf`;
                const filledPath = path.join(filledDir, filledFilename);
                const fillResult = await fillPDFForm(form.file_path, dataMap, filledPath);

                const insertResult = await prepareRun(
                    `INSERT INTO filled_forms (form_id, client_id, file_path, original_form_name) VALUES (?, ?, ?, ?)`,
                    form.id, form.client_id, filledPath, form.original_name
                );

                const filledForm = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', insertResult.lastInsertRowid);
                results.push({
                    ...filledForm,
                    fields_filled: fillResult.fieldsFilled,
                    fields_total: fillResult.fieldsTotal,
                    download_url: `/api/filled-forms/${filledForm.id}/download`
                });
            } catch (e) {
                results.push({ form_id: form.id, form_name: form.original_name, error: e.message });
            }
        }

        res.json(results);
    } catch (err) {
        console.error('Error filling all forms:', err);
        res.status(500).json({ error: 'Failed to fill forms' });
    }
});

// GET /api/filled-forms/:id/download
router.get('/filled-forms/:id/download', async (req, res) => {
    try {
        const filled = await prepareGet('SELECT * FROM filled_forms WHERE id = ?', parseInt(req.params.id));
        if (!filled) {
            return res.status(404).json({ error: 'Filled form not found' });
        }
        const downloadName = `filled_${filled.original_form_name || 'form.pdf'}`;
        res.download(filled.file_path, downloadName);
    } catch (err) {
        console.error('Error downloading filled form:', err);
        res.status(500).json({ error: 'Failed to download filled form' });
    }
});

// DELETE /api/forms/:id
router.delete('/forms/:id', async (req, res) => {
    try {
        const form = await prepareGet('SELECT * FROM forms WHERE id = ?', parseInt(req.params.id));
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        if (fs.existsSync(form.file_path)) {
            fs.unlinkSync(form.file_path);
        }
        await prepareRun('DELETE FROM forms WHERE id = ?', parseInt(req.params.id));
        res.json({ message: 'Form deleted successfully' });
    } catch (err) {
        console.error('Error deleting form:', err);
        res.status(500).json({ error: 'Failed to delete form' });
    }
});

module.exports = router;
