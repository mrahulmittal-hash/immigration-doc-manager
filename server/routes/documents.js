const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { extractTextFromPDF } = require('../services/pdfParser');
const { createMulterStorage, deleteFromS3, getDownloadUrl, isS3Enabled } = require('../services/storageService');

const { storage } = createMulterStorage('documents', 'documents');

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, Images, DOC/DOCX'));
        }
    }
});

// POST /api/clients/:clientId/documents
router.post('/clients/:clientId/documents', upload.array('files', 20), async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const client = await prepareGet('SELECT id FROM clients WHERE id = ?', clientId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const category = req.body.category || 'general';
        const docs = [];

        for (const file of req.files) {
            // When using S3, multer-s3 puts the S3 key in file.key and the location in file.location
            const storedPath = isS3Enabled()
                ? `s3://${process.env.S3_BUCKET_NAME}/${file.key}`
                : file.path;
            const filename = isS3Enabled() ? file.key : file.filename;

            const result = await prepareRun(
                `INSERT INTO documents (client_id, filename, original_name, file_path, file_type, file_size, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                clientId, filename, file.originalname, storedPath, file.mimetype, file.size, category
            );
            const doc = await prepareGet('SELECT * FROM documents WHERE id = ?', result.lastInsertRowid);
            docs.push(doc);
        }

        res.status(201).json(docs);
    } catch (err) {
        console.error('Error uploading documents:', err);
        res.status(500).json({ error: 'Failed to upload documents' });
    }
});

// GET /api/clients/:clientId/documents
router.get('/clients/:clientId/documents', async (req, res) => {
    try {
        const docs = await prepareAll('SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at DESC', parseInt(req.params.clientId));
        res.json(docs);
    } catch (err) {
        console.error('Error listing documents:', err);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// GET /api/documents/:id/download
router.get('/documents/:id/download', async (req, res) => {
    try {
        const doc = await prepareGet('SELECT * FROM documents WHERE id = ?', parseInt(req.params.id));
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (doc.file_path && doc.file_path.startsWith('s3://')) {
            const url = await getDownloadUrl(doc.file_path, req);
            return res.redirect(url);
        }
        res.download(doc.file_path, doc.original_name);
    } catch (err) {
        console.error('Error downloading document:', err);
        res.status(500).json({ error: 'Failed to download document' });
    }
});

// POST /api/documents/:id/extract
router.post('/documents/:id/extract', async (req, res) => {
    try {
        const doc = await prepareGet('SELECT * FROM documents WHERE id = ?', parseInt(req.params.id));
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const ext = doc.original_name.toLowerCase();
        const isSupported = ext.endsWith('.pdf') || ext.match(/\.(png|jpg|jpeg|gif|bmp|tiff|tif)$/);
        if (!isSupported) {
            return res.status(400).json({ error: 'Only PDF and image documents can be extracted' });
        }

        const extracted = await extractTextFromPDF(doc.file_path);

        await prepareRun('UPDATE documents SET extracted_text = ? WHERE id = ?', extracted.text, doc.id);

        if (extracted.data && Object.keys(extracted.data).length > 0) {
            for (const [key, value] of Object.entries(extracted.data)) {
                await prepareRun('DELETE FROM client_data WHERE client_id = ? AND field_key = ? AND source = ?', doc.client_id, key, 'extracted');
                await prepareRun('INSERT INTO client_data (client_id, field_key, field_value, source) VALUES (?, ?, ?, ?)', doc.client_id, key, value, 'extracted');
            }
        }

        res.json({ text: extracted.text, data: extracted.data });
    } catch (err) {
        console.error('Error extracting text:', err);
        res.status(500).json({ error: 'Failed to extract text from document' });
    }
});

// DELETE /api/documents/:id
router.delete('/documents/:id', async (req, res) => {
    try {
        const doc = await prepareGet('SELECT * FROM documents WHERE id = ?', parseInt(req.params.id));
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (doc.file_path && doc.file_path.startsWith('s3://')) {
            const key = doc.file_path.replace(`s3://${process.env.S3_BUCKET_NAME}/`, '');
            await deleteFromS3(key);
        } else if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
        }
        await prepareRun('DELETE FROM documents WHERE id = ?', parseInt(req.params.id));
        res.json({ message: 'Document deleted successfully' });
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// POST /api/clients/:clientId/documents/extract-all
router.post('/clients/:clientId/documents/extract-all', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const client = await prepareGet('SELECT * FROM clients WHERE id = ?', clientId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const docs = await prepareAll('SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at ASC', clientId);
        if (docs.length === 0) {
            return res.status(400).json({ error: 'No documents uploaded for this client' });
        }

        const results = [];
        const mergedData = {};
        let textDocs = 0;
        let imageDocs = 0;

        for (const doc of docs) {
            const docResult = {
                id: doc.id,
                original_name: doc.original_name,
                category: doc.category,
                status: 'skipped',
                fieldsExtracted: 0,
                isImageOnly: false,
                error: null
            };

            const extLower = doc.original_name.toLowerCase();
            const isExtractable = extLower.endsWith('.pdf') || extLower.match(/\.(png|jpg|jpeg|gif|bmp|tiff|tif)$/);
            if (!isExtractable) {
                docResult.error = 'Unsupported file type for extraction';
                results.push(docResult);
                continue;
            }

            if (!fs.existsSync(doc.file_path)) {
                docResult.status = 'error';
                docResult.error = 'File not found on disk';
                results.push(docResult);
                continue;
            }

            try {
                const extracted = await extractTextFromPDF(doc.file_path);

                if (extracted.text) {
                    await prepareRun('UPDATE documents SET extracted_text = ? WHERE id = ?', extracted.text, doc.id);
                }

                if (extracted.isImageOnly) {
                    docResult.status = 'image_only';
                    docResult.isImageOnly = true;
                    imageDocs++;
                } else {
                    docResult.status = 'extracted';
                    textDocs++;

                    if (extracted.data && Object.keys(extracted.data).length > 0) {
                        docResult.fieldsExtracted = Object.keys(extracted.data).length;
                        for (const [key, value] of Object.entries(extracted.data)) {
                            if (!mergedData[key] || value.length > (mergedData[key] || '').length) {
                                mergedData[key] = value;
                            }
                        }
                    }
                }
            } catch (e) {
                docResult.status = 'error';
                docResult.error = e.message;
            }

            results.push(docResult);
        }

        // Client profile data takes precedence
        if (client.first_name) mergedData['first_name'] = client.first_name;
        if (client.last_name) mergedData['last_name'] = client.last_name;
        if (client.first_name && client.last_name) mergedData['full_name'] = `${client.first_name} ${client.last_name}`;
        if (client.email) mergedData['email'] = client.email;
        if (client.phone) mergedData['phone'] = client.phone;
        if (client.nationality) mergedData['nationality'] = client.nationality;
        if (client.date_of_birth) mergedData['date_of_birth'] = client.date_of_birth;
        if (client.passport_number) mergedData['passport_number'] = client.passport_number;
        if (client.visa_type) mergedData['visa_type'] = client.visa_type;

        for (const [key, value] of Object.entries(mergedData)) {
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

        const totalFieldsExtracted = Object.keys(mergedData).filter(k => mergedData[k] && mergedData[k].toString().trim()).length;

        res.json({
            summary: {
                total_documents: docs.length,
                text_documents: textDocs,
                image_documents: imageDocs,
                skipped: docs.length - textDocs - imageDocs,
                total_fields_extracted: totalFieldsExtracted,
            },
            merged_data: mergedData,
            documents: results,
        });
    } catch (err) {
        console.error('Error extracting all documents:', err);
        res.status(500).json({ error: 'Failed to extract documents: ' + err.message });
    }
});

module.exports = router;
