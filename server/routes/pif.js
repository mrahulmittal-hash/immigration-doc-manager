const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { createMulterStorage, deleteFromS3, isS3Enabled } = require('../services/storageService');

const { storage: pifStorage } = createMulterStorage('pif-documents', 'pif-documents');

const pifUpload = multer({
    storage: pifStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Invalid file type. Allowed: PDF, Images, DOC/DOCX'));
    }
});

// GET /api/pif/:token — Validate token and return client info for the form header
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const client = await prepareGet('SELECT id, first_name, last_name, visa_type, pif_status FROM clients WHERE form_token = ?', token);

        if (!client) {
            return res.status(404).json({ error: 'Invalid or expired form link' });
        }

        const existing = await prepareGet('SELECT id, submitted_at FROM pif_submissions WHERE client_id = ?', client.id);

        res.json({
            client_name: `${client.first_name} ${client.last_name}`,
            service_type: client.visa_type,
            pif_status: client.pif_status,
            already_submitted: !!existing,
            submitted_at: existing?.submitted_at || null
        });
    } catch (err) {
        console.error('Error fetching PIF form info:', err);
        res.status(500).json({ error: 'Failed to load form' });
    }
});

// POST /api/pif/:token — Save PIF submission
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const client = await prepareGet('SELECT id, first_name, last_name FROM clients WHERE form_token = ?', token);

        if (!client) {
            return res.status(404).json({ error: 'Invalid or expired form link' });
        }

        const formData = req.body;
        if (!formData || Object.keys(formData).length === 0) {
            return res.status(400).json({ error: 'No form data provided' });
        }

        const formDataJson = JSON.stringify(formData);

        const existing = await prepareGet('SELECT id FROM pif_submissions WHERE client_id = ?', client.id);

        if (existing) {
            await prepareRun(
                'UPDATE pif_submissions SET form_data = ?, updated_at = NOW() WHERE client_id = ?',
                formDataJson, client.id
            );
        } else {
            await prepareRun(
                'INSERT INTO pif_submissions (client_id, form_data) VALUES (?, ?)',
                client.id, formDataJson
            );
        }

        await prepareRun("UPDATE clients SET pif_status = 'completed', updated_at = NOW() WHERE id = ?", client.id);

        console.log(`✅ PIF submission received for ${client.first_name} ${client.last_name} (ID: ${client.id})`);
        res.json({ success: true, message: 'Personal Information Form submitted successfully' });
    } catch (err) {
        console.error('Error saving PIF submission:', err);
        res.status(500).json({ error: 'Failed to save form submission' });
    }
});

// GET /api/pif/data/:clientId — Get PIF submission data for admin view
router.get('/data/:clientId', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const submission = await prepareGet('SELECT * FROM pif_submissions WHERE client_id = ?', clientId);

        if (!submission) {
            return res.json({ submitted: false });
        }

        res.json({
            submitted: true,
            data: JSON.parse(submission.form_data),
            submitted_at: submission.submitted_at,
            updated_at: submission.updated_at
        });
    } catch (err) {
        console.error('Error fetching PIF data:', err);
        res.status(500).json({ error: 'Failed to fetch PIF data' });
    }
});

// POST /api/pif/:token/upload — Client uploads supporting documents for a PIF section
router.post('/:token/upload', pifUpload.array('files', 10), async (req, res) => {
    try {
        const { token } = req.params;
        const client = await prepareGet('SELECT id FROM clients WHERE form_token = ?', token);
        if (!client) return res.status(404).json({ error: 'Invalid or expired form link' });

        const section = req.body.section || 'general';
        const docs = [];

        for (const file of req.files) {
            const storedPath = isS3Enabled()
                ? `s3://${process.env.S3_BUCKET_NAME}/${file.key}`
                : file.path;
            const filename = isS3Enabled() ? file.key : file.filename;

            const result = await prepareRun(
                `INSERT INTO documents (client_id, filename, original_name, file_path, file_type, file_size, category, source)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pif-upload')`,
                client.id, filename, file.originalname, storedPath, file.mimetype, file.size, section
            );
            const doc = await prepareGet('SELECT id, original_name, file_size, category, uploaded_at FROM documents WHERE id = ?', result.lastInsertRowid);
            docs.push(doc);
        }

        res.status(201).json(docs);
    } catch (err) {
        console.error('Error uploading PIF documents:', err);
        res.status(500).json({ error: 'Failed to upload documents' });
    }
});

// GET /api/pif/:token/uploads — List all PIF-uploaded documents for this client
router.get('/:token/uploads', async (req, res) => {
    try {
        const { token } = req.params;
        const client = await prepareGet('SELECT id FROM clients WHERE form_token = ?', token);
        if (!client) return res.status(404).json({ error: 'Invalid or expired form link' });

        const docs = await prepareAll(
            "SELECT id, original_name, file_size, category, uploaded_at FROM documents WHERE client_id = ? AND source = 'pif-upload' ORDER BY uploaded_at DESC",
            client.id
        );
        res.json(docs);
    } catch (err) {
        console.error('Error listing PIF uploads:', err);
        res.status(500).json({ error: 'Failed to list uploads' });
    }
});

// DELETE /api/pif/:token/uploads/:docId — Client deletes an uploaded PIF document
router.delete('/:token/uploads/:docId', async (req, res) => {
    try {
        const { token, docId } = req.params;
        const client = await prepareGet('SELECT id FROM clients WHERE form_token = ?', token);
        if (!client) return res.status(404).json({ error: 'Invalid or expired form link' });

        const doc = await prepareGet("SELECT * FROM documents WHERE id = ? AND client_id = ? AND source = 'pif-upload'", parseInt(docId), client.id);
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        if (doc.file_path && doc.file_path.startsWith('s3://')) {
            const key = doc.file_path.replace(`s3://${process.env.S3_BUCKET_NAME}/`, '');
            await deleteFromS3(key);
        } else if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
        }
        await prepareRun('DELETE FROM documents WHERE id = ?', parseInt(docId));
        res.json({ message: 'Document deleted' });
    } catch (err) {
        console.error('Error deleting PIF document:', err);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// POST /api/pif/data/:clientId/verify — Admin verifies PIF data against uploaded documents
router.post('/data/:clientId/verify', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        
        const submission = await prepareGet('SELECT * FROM pif_submissions WHERE client_id = ?', clientId);
        if (!submission) {
            return res.status(400).json({ error: 'No PIF submission found for this client.' });
        }
        const pifData = JSON.parse(submission.form_data);
        
        const docs = await prepareAll(
            "SELECT * FROM documents WHERE client_id = ? AND source = 'pif-upload'",
            clientId
        );
        
        const { extractTextFromPDF } = require('../services/pdfParser');
        const docTexts = {};
        
        for (const doc of docs) {
            if (doc.original_name.toLowerCase().endsWith('.pdf')) {
                if (!doc.extracted_text) {
                     if (fs.existsSync(doc.file_path)) {
                         try {
                             const extracted = await extractTextFromPDF(doc.file_path);
                             docTexts[doc.id] = extracted.text ? extracted.text.toLowerCase() : '';
                             if (extracted.text) {
                                 await prepareRun('UPDATE documents SET extracted_text = ? WHERE id = ?', extracted.text, doc.id);
                             }
                         } catch (e) {
                             console.error(`Failed to extract text for doc ${doc.id}:`, e);
                             docTexts[doc.id] = '';
                         }
                     } else {
                         docTexts[doc.id] = '';
                     }
                } else {
                    docTexts[doc.id] = doc.extracted_text.toLowerCase();
                }
            } else {
                docTexts[doc.id] = '';
            }
        }
        
        const isFilled = (val) => {
            if (val === null || val === undefined || val === '') return false;
            if (typeof val === 'boolean') return true;
            return String(val).trim() !== '';
        };

        const verifyValue = (val, sectionDocs) => {
            if (typeof val === 'boolean') return true;
            const searchStr = String(val).toLowerCase().trim();
            if (searchStr.length < 3) return true;
            const cleanSearchStr = searchStr.replace(/[^\w\s]/g, '');
            const parts = cleanSearchStr.split(/\s+/).filter(p => p.length >= 3);
            
            for (const doc of sectionDocs) {
                const text = docTexts[doc.id] || '';
                if (text.includes(searchStr)) return true;
                if (parts.length > 1) {
                    let matchCount = 0;
                    for (const part of parts) {
                        if (text.includes(part)) matchCount++;
                    }
                    if (matchCount / parts.length >= 0.7) return true;
                }
            }
            return false;
        };

        const results = {};
        
        const sectionScalarFields = {
            personal: ['firstName', 'lastName', 'dob', 'placeOfBirth', 'nationality', 'gender', 'eyeColour', 'height'],
            canada: ['appliedBeforeDetails', 'refusedBeforeDetails', 'medicalExamDetails', 'firstEntryDate', 'placeOfEntry', 'purposeOfVisit', 'lastEntryDate', 'lastEntryPlace'],
            passport: ['passportNumber', 'passportIssueDate', 'passportExpiryDate', 'passportCountry', 'maritalStatus'],
            spouse: ['spouseMarriageDate', 'spouseFirstName', 'spouseLastName', 'spouseDob', 'spousePlaceOfBirth', 'spouseOccupation', 'spouseAddress', 'prevMarriageDate', 'prevMarriageEndDate', 'prevSpouseFirstName', 'prevSpouseLastName', 'prevSpouseDob'],
            parents: ['motherFirstName', 'motherLastName', 'motherDob', 'motherDeathDate', 'motherPlaceOfBirth', 'motherOccupation', 'motherAddress', 'fatherFirstName', 'fatherLastName', 'fatherDob', 'fatherDeathDate', 'fatherPlaceOfBirth', 'fatherOccupation', 'fatherAddress'],
            language: ['ieltsListening', 'ieltsReading', 'ieltsWriting', 'ieltsSpeaking', 'ieltsOverall']
        };

        const sectionArrayFields = {
            education: ['from', 'to', 'institute', 'city', 'field'],
            work: ['from', 'to', 'jobTitle', 'city', 'country', 'companyName'],
            children: ['firstName', 'lastName', 'dob', 'placeOfBirth', 'occupation', 'currentAddress'],
            siblings: ['name', 'dob', 'placeOfBirth', 'occupation', 'addressEmail'],
            addresses: ['address', 'cityState', 'country'],
            travel: ['place', 'purpose'],
            relatives: ['firstName', 'lastName', 'city', 'phone', 'email']
        };

        const allSections = [...Object.keys(sectionScalarFields), ...Object.keys(sectionArrayFields)];

        for (const section of allSections) {
            const sectionDocs = docs.filter(d => d.category === section);
            results[section] = {
                status: 'ok',
                mismatches: [],
                docsCount: sectionDocs.length
            };

            let hasData = false;
            
            if (sectionScalarFields[section]) {
                 for (const field of sectionScalarFields[section]) {
                     if (isFilled(pifData[field])) {
                         hasData = true;
                         if (sectionDocs.length === 0) {
                             results[section].mismatches.push({ field, value: pifData[field], reason: 'No documents uploaded for this section' });
                         } else {
                             const verified = verifyValue(pifData[field], sectionDocs);
                             if (!verified) {
                                 results[section].mismatches.push({ field, value: pifData[field], reason: 'Value not found in uploaded documents' });
                             }
                         }
                     }
                 }
            } else if (sectionArrayFields[section] && Array.isArray(pifData[section])) {
                 for (let i = 0; i < pifData[section].length; i++) {
                     const row = pifData[section][i];
                     for (const field of sectionArrayFields[section]) {
                         if (isFilled(row[field])) {
                             hasData = true;
                             if (sectionDocs.length === 0) {
                                  results[section].mismatches.push({ field: `${field} (Row ${i+1})`, value: row[field], reason: 'No documents uploaded for this section' });
                             } else {
                                  const verified = verifyValue(row[field], sectionDocs);
                                  if (!verified) {
                                      results[section].mismatches.push({ field: `${field} (Row ${i+1})`, value: row[field], reason: 'Value not found in uploaded documents' });
                                  }
                             }
                         }
                     }
                 }
            }
            
            if (results[section].mismatches.length > 0) {
                results[section].status = 'mismatch';
            } else if (!hasData) {
                results[section].status = 'empty';
            }
        }

        res.json({ verified: true, results });

    } catch (err) {
        console.error('Error verifying PIF data:', err);
        res.status(500).json({ error: 'Failed to verify PIF data' });
    }
});

module.exports = router;
