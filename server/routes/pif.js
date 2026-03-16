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

// ═══════════════════════════════════════════════════════════════
// IMPORTANT: /data/* routes MUST come before /:token routes
// because Express matches /:token first otherwise (e.g. "data" as token)
// ═══════════════════════════════════════════════════════════════

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

// PUT /api/pif/data/:clientId — Admin edits PIF data
router.put('/data/:clientId', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const { form_data } = req.body;
        if (!form_data) return res.status(400).json({ error: 'form_data is required' });

        const existing = await prepareGet('SELECT * FROM pif_submissions WHERE client_id = ?', clientId);
        if (!existing) {
            return res.status(404).json({ error: 'No PIF submission found for this client.' });
        }

        await prepareRun(
            'UPDATE pif_submissions SET form_data = ?, updated_at = NOW() WHERE client_id = ?',
            JSON.stringify(form_data), clientId
        );

        res.json({ success: true, message: 'PIF data updated successfully' });
    } catch (err) {
        console.error('Error updating PIF data:', err);
        res.status(500).json({ error: 'Failed to update PIF data' });
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

// GET /api/pif/data/:clientId/ocr — Get OCR extracted data from all PIF-uploaded documents
router.get('/data/:clientId/ocr', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);

        const docs = await prepareAll(
            "SELECT * FROM documents WHERE client_id = ? AND source = 'pif-upload' ORDER BY category, created_at",
            clientId
        );

        const { extractTextFromPDF } = require('../services/pdfParser');
        const ocrResults = [];

        for (const doc of docs) {
            const result = {
                id: doc.id,
                original_name: doc.original_name,
                category: doc.category,
                file_size: doc.file_size,
                created_at: doc.created_at,
                extracted_text: null,
                extracted_data: null,
                is_image_only: false,
                error: null,
            };

            if (doc.original_name.toLowerCase().match(/\.(pdf)$/)) {
                if (doc.extracted_text) {
                    result.extracted_text = doc.extracted_text;
                    try {
                        const filePath = doc.file_path?.startsWith('s3://')
                            ? null : doc.file_path;
                        if (filePath && fs.existsSync(filePath)) {
                            const parsed = await extractTextFromPDF(filePath);
                            result.extracted_data = parsed.data || {};
                            result.is_image_only = parsed.isImageOnly || false;
                        } else {
                            result.extracted_data = parseFieldsFromText(doc.extracted_text);
                        }
                    } catch (e) {
                        result.extracted_data = parseFieldsFromText(doc.extracted_text);
                    }
                } else {
                    const filePath = doc.file_path?.startsWith('s3://')
                        ? null : doc.file_path;
                    if (filePath && fs.existsSync(filePath)) {
                        try {
                            const parsed = await extractTextFromPDF(filePath);
                            result.extracted_text = parsed.text || '';
                            result.extracted_data = parsed.data || {};
                            result.is_image_only = parsed.isImageOnly || false;
                            if (parsed.text) {
                                await prepareRun('UPDATE documents SET extracted_text = ? WHERE id = ?', parsed.text, doc.id);
                            }
                        } catch (e) {
                            result.error = 'Failed to extract text from PDF';
                        }
                    } else {
                        result.error = 'File not accessible';
                    }
                }
            } else if (doc.original_name.toLowerCase().match(/\.(png|jpg|jpeg|gif|bmp|tiff|tif)$/)) {
                const filePath = doc.file_path?.startsWith('s3://') ? null : doc.file_path;
                if (filePath && fs.existsSync(filePath)) {
                    try {
                        const parsed = await extractTextFromPDF(filePath);
                        result.extracted_text = parsed.text || '';
                        result.extracted_data = parsed.data || {};
                        result.is_image_only = parsed.isImageOnly || false;
                        if (parsed.text) {
                            await prepareRun('UPDATE documents SET extracted_text = ? WHERE id = ?', parsed.text, doc.id);
                        }
                    } catch (e) {
                        result.error = 'Failed to OCR image: ' + e.message;
                        result.is_image_only = true;
                    }
                } else {
                    result.error = 'File not accessible';
                    result.is_image_only = true;
                }
            }

            ocrResults.push(result);
        }

        // Build a merged field map from all OCR results
        const mergedOcrData = {};
        for (const r of ocrResults) {
            if (r.extracted_data) {
                for (const [key, value] of Object.entries(r.extracted_data)) {
                    if (value && !mergedOcrData[key]) {
                        mergedOcrData[key] = { value, source_doc: r.original_name, doc_id: r.id };
                    }
                }
            }
        }

        res.json({
            documents: ocrResults,
            merged_data: mergedOcrData,
            total_docs: docs.length,
        });

    } catch (err) {
        console.error('Error getting OCR data:', err);
        res.status(500).json({ error: 'Failed to get OCR data' });
    }
});

// POST /api/pif/data/:clientId/autofill — Auto-fill empty PIF fields from OCR-extracted data
router.post('/data/:clientId/autofill', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);

        // Get existing PIF submission or create empty one
        let submission = await prepareGet('SELECT * FROM pif_submissions WHERE client_id = ?', clientId);
        let pifData = submission ? JSON.parse(submission.form_data) : {};

        // Get all documents for this client (both admin-uploaded and PIF-uploaded)
        const docs = await prepareAll(
            'SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at ASC',
            clientId
        );

        const { extractTextFromPDF } = require('../services/pdfParser');

        // Extract text from all documents and merge data
        const mergedData = {};
        for (const doc of docs) {
            const extLower = doc.original_name.toLowerCase();
            const isExtractable = extLower.endsWith('.pdf') || extLower.match(/\.(png|jpg|jpeg|gif|bmp|tiff|tif)$/);
            if (!isExtractable) continue;

            const filePath = doc.file_path?.startsWith('s3://') ? null : doc.file_path;
            if (!filePath || !fs.existsSync(filePath)) continue;

            try {
                const extracted = await extractTextFromPDF(filePath);
                if (extracted.text) {
                    await prepareRun('UPDATE documents SET extracted_text = ? WHERE id = ?', extracted.text, doc.id);
                }

                if (extracted.data) {
                    for (const [key, value] of Object.entries(extracted.data)) {
                        if (value && (!mergedData[key] || value.length > mergedData[key].length)) {
                            mergedData[key] = value;
                        }
                    }
                }
            } catch (e) {
                console.warn(`Auto-fill: failed to extract doc ${doc.id}:`, e.message);
            }
        }

        // Also pull from client_data table (extracted fields)
        const clientDataRows = await prepareAll(
            'SELECT field_key, field_value FROM client_data WHERE client_id = ? ORDER BY source ASC',
            clientId
        );
        for (const row of clientDataRows) {
            if (row.field_value && !mergedData[row.field_key]) {
                mergedData[row.field_key] = row.field_value;
            }
        }

        // Also pull from client profile
        const client = await prepareGet('SELECT * FROM clients WHERE id = ?', clientId);
        if (client) {
            if (client.first_name) mergedData['first_name'] = client.first_name;
            if (client.first_name) mergedData['given_names'] = client.first_name;
            if (client.last_name) mergedData['surname'] = client.last_name;
            if (client.last_name) mergedData['last_name'] = client.last_name;
            if (client.email) mergedData['email'] = client.email;
            if (client.phone) mergedData['phone'] = client.phone;
            if (client.nationality) mergedData['nationality'] = client.nationality;
            if (client.date_of_birth) mergedData['date_of_birth'] = client.date_of_birth;
            if (client.passport_number) mergedData['passport_number'] = client.passport_number;
        }

        // Comprehensive OCR-to-PIF field mapping
        const OCR_TO_PIF = {
            first_name: 'firstName', given_names: 'firstName',
            last_name: 'lastName', surname: 'lastName', family_name: 'lastName',
            date_of_birth: 'dob',
            passport_number: 'passportNumber', document_number: 'passportNumber',
            nationality: 'nationality', citizenship: 'nationality',
            place_of_birth: 'placeOfBirth',
            sex: 'gender',
            date_of_issue: 'passportIssueDate',
            date_of_expiry: 'passportExpiryDate',
            country_of_issue: 'passportCountry',
            country_of_residence: 'passportCountry',
            marital_status: 'maritalStatus',
            date_of_marriage: 'spouseMarriageDate',
            occupation: 'spouseOccupation',
            email: 'email', phone: 'phone',
            eye_colour: 'eyeColour',
            height: 'height',
            address: 'spouseAddress',
            employer_name: 'employer',
            ielts_listening: 'ieltsListening',
            ielts_reading: 'ieltsReading',
            ielts_writing: 'ieltsWriting',
            ielts_speaking: 'ieltsSpeaking',
            ielts_overall: 'ieltsOverall',
            test_type: 'testType',
        };

        // Normalize gender values
        const normalizeGender = (val) => {
            const v = val.toLowerCase().trim();
            if (v === 'm' || v === 'male') return 'Male';
            if (v === 'f' || v === 'female') return 'Female';
            return val;
        };

        // Normalize marital status
        const normalizeMarital = (val) => {
            const v = val.toLowerCase().trim();
            if (v === 'single') return 'Single';
            if (v === 'married') return 'Married';
            if (v === 'divorced') return 'Divorced';
            if (v === 'widowed') return 'Widowed';
            if (v === 'separated') return 'Separated';
            if (v.includes('common')) return 'Common-Law';
            return val;
        };

        // Auto-fill: only set empty PIF fields
        const filledFields = {};
        const isFilled = (val) => val !== null && val !== undefined && val !== '' && String(val).trim() !== '';

        for (const [ocrKey, pifKey] of Object.entries(OCR_TO_PIF)) {
            if (mergedData[ocrKey] && !isFilled(pifData[pifKey])) {
                let value = mergedData[ocrKey];
                if (pifKey === 'gender') value = normalizeGender(value);
                if (pifKey === 'maritalStatus') value = normalizeMarital(value);
                pifData[pifKey] = value;
                filledFields[pifKey] = { value, source: ocrKey };
            }
        }

        // Handle full_name → split into firstName + lastName if both empty
        if (mergedData['full_name'] && !isFilled(pifData['firstName']) && !isFilled(pifData['lastName'])) {
            const parts = mergedData['full_name'].split(/\s+/);
            if (parts.length >= 2) {
                pifData['firstName'] = parts[0];
                pifData['lastName'] = parts.slice(1).join(' ');
                filledFields['firstName'] = { value: parts[0], source: 'full_name' };
                filledFields['lastName'] = { value: parts.slice(1).join(' '), source: 'full_name' };
            }
        }

        // Save updated PIF data
        if (submission) {
            await prepareRun(
                'UPDATE pif_submissions SET form_data = ?, updated_at = NOW() WHERE client_id = ?',
                JSON.stringify(pifData), clientId
            );
        } else {
            await prepareRun(
                'INSERT INTO pif_submissions (client_id, form_data) VALUES (?, ?)',
                clientId, JSON.stringify(pifData)
            );
        }

        res.json({
            success: true,
            fields_filled: Object.keys(filledFields).length,
            filled: filledFields,
            form_data: pifData,
        });

    } catch (err) {
        console.error('Error auto-filling PIF:', err);
        res.status(500).json({ error: 'Failed to auto-fill PIF data' });
    }
});

// ═══════════════════════════════════════════════════════════════
// /:token wildcard routes — MUST come AFTER /data/* routes
// ═══════════════════════════════════════════════════════════════

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

        console.log(`PIF submission received for ${client.first_name} ${client.last_name} (ID: ${client.id})`);
        res.json({ success: true, message: 'Personal Information Form submitted successfully' });
    } catch (err) {
        console.error('Error saving PIF submission:', err);
        res.status(500).json({ error: 'Failed to save form submission' });
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

// Helper: parse common fields from raw text
function parseFieldsFromText(text) {
    if (!text) return {};
    const data = {};
    const t = text;

    const nameMatch = t.match(/(?:surname|family name|last name)[:\s]*([A-Za-z\s-]+)/i);
    if (nameMatch) data.last_name = nameMatch[1].trim();
    const givenMatch = t.match(/(?:given name|first name|forename)[:\s]*([A-Za-z\s-]+)/i);
    if (givenMatch) data.first_name = givenMatch[1].trim();

    const passportMatch = t.match(/(?:passport|document)\s*(?:no|number|#)[.:\s]*([A-Z0-9]{5,12})/i);
    if (passportMatch) data.passport_number = passportMatch[1].trim();

    const dobMatch = t.match(/(?:date of birth|birth date|dob|born)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{4}|\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i);
    if (dobMatch) data.date_of_birth = dobMatch[1].trim();

    const natMatch = t.match(/(?:nationality|citizenship)[:\s]*([A-Za-z\s]+)/i);
    if (natMatch) data.nationality = natMatch[1].trim().substring(0, 40);

    const pobMatch = t.match(/(?:place of birth|birth place|born in)[:\s]*([A-Za-z\s,]+)/i);
    if (pobMatch) data.place_of_birth = pobMatch[1].trim().substring(0, 60);

    const genderMatch = t.match(/(?:sex|gender)[:\s]*(male|female|m|f)/i);
    if (genderMatch) data.sex = genderMatch[1].trim();

    const issueMatch = t.match(/(?:date of issue|issued?)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{4}|\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i);
    if (issueMatch) data.date_of_issue = issueMatch[1].trim();
    const expiryMatch = t.match(/(?:date of expiry|expir\w*|valid until)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{4}|\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i);
    if (expiryMatch) data.date_of_expiry = expiryMatch[1].trim();

    return data;
}

module.exports = router;
