const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { getSupportedVisaTypes, getFormsForVisaType } = require('../services/irccFormTemplates');

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
                uploaded: !!uploadedMap[f.formNumber],
                uploadedInfo: uploadedMap[f.formNumber] || null,
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
