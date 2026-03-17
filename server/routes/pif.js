const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { createMulterStorage, deleteFromS3, isS3Enabled } = require('../services/storageService');
const { completeWorkflowTask } = require('../services/autoTaskService');

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

// Helper: compute diff between old and new PIF data
function computePifDiff(oldData, newData) {
    const diff = {};
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    for (const key of allKeys) {
        if (key === 'consent') continue;
        const oldVal = JSON.stringify(oldData?.[key] ?? '');
        const newVal = JSON.stringify(newData?.[key] ?? '');
        if (oldVal !== newVal) {
            diff[key] = { old: oldData?.[key] ?? '', new: newData?.[key] ?? '' };
        }
    }
    return diff;
}

// PUT /api/pif/data/:clientId — Admin edits PIF data (with change tracking)
router.put('/data/:clientId', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const { form_data } = req.body;
        if (!form_data) return res.status(400).json({ error: 'form_data is required' });

        const existing = await prepareGet('SELECT * FROM pif_submissions WHERE client_id = ?', clientId);
        let changesDetected = false;
        let changedCount = 0;
        let reverificationId = null;

        if (existing) {
            const oldData = JSON.parse(existing.form_data || '{}');
            const diff = computePifDiff(oldData, form_data);
            changedCount = Object.keys(diff).length;
            changesDetected = changedCount > 0;

            if (changesDetected) {
                // Clear consent since data changed
                form_data.consent = false;

                // Mark older pending requests as superseded
                await prepareRun(
                    `UPDATE pif_reverification_requests SET status = 'superseded' WHERE client_id = ? AND status IN ('pending', 'sent')`,
                    clientId
                );

                // Create new reverification request
                const result = await prepareGet(
                    `INSERT INTO pif_reverification_requests (client_id, changed_fields, changed_by) VALUES (?, ?::jsonb, ?) RETURNING id`,
                    clientId, JSON.stringify(diff), req.user?.id || null
                );
                reverificationId = result?.id;
            }

            await prepareRun(
                'UPDATE pif_submissions SET form_data = ?, updated_at = NOW() WHERE client_id = ?',
                JSON.stringify(form_data), clientId
            );
        } else {
            await prepareRun(
                'INSERT INTO pif_submissions (client_id, form_data) VALUES (?, ?)',
                clientId, JSON.stringify(form_data)
            );
        }

        res.json({
            success: true,
            message: 'PIF data updated successfully',
            changes_detected: changesDetected,
            changed_count: changedCount,
            reverification_id: reverificationId
        });
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
// Per-Field Verification Endpoints
// ═══════════════════════════════════════════════════════════════

// GET /api/pif/data/:clientId/verifications — Get all field verification records
router.get('/data/:clientId/verifications', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const rows = await prepareAll(
            `SELECT v.*, u.name as verified_by_name FROM pif_field_verifications v
             LEFT JOIN users u ON u.id = v.verified_by
             WHERE v.client_id = ?`,
            clientId
        );
        // Return as object keyed by field_key
        const verifications = {};
        for (const row of rows) {
            verifications[row.field_key] = row;
        }
        res.json(verifications);
    } catch (err) {
        console.error('Error fetching verifications:', err);
        res.status(500).json({ error: 'Failed to fetch verifications' });
    }
});

// PUT /api/pif/data/:clientId/verify-field — Verify/flag a single PIF field
router.put('/data/:clientId/verify-field', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const { field_key, verified, comment } = req.body;
        if (!field_key) return res.status(400).json({ error: 'field_key is required' });

        const existing = await prepareGet(
            'SELECT * FROM pif_field_verifications WHERE client_id = ? AND field_key = ?',
            clientId, field_key
        );

        if (existing) {
            await prepareRun(
                `UPDATE pif_field_verifications SET verified = ?, comment = ?, verified_by = ?, verified_at = NOW()
                 WHERE client_id = ? AND field_key = ?`,
                verified !== undefined ? verified : existing.verified,
                comment !== undefined ? comment : existing.comment,
                req.user?.id || null,
                clientId, field_key
            );
        } else {
            await prepareRun(
                `INSERT INTO pif_field_verifications (client_id, field_key, verified, comment, verified_by)
                 VALUES (?, ?, ?, ?, ?)`,
                clientId, field_key, verified || false, comment || null, req.user?.id || null
            );
        }

        // Audit log
        const { logAudit } = require('../middleware/audit');
        await logAudit(req, {
            clientId,
            entityType: 'verification',
            entityId: null,
            action: verified ? 'verify' : 'flag',
            fieldKey: field_key,
            oldValue: existing ? String(existing.verified) : null,
            newValue: String(verified || false),
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Error verifying field:', err);
        res.status(500).json({ error: 'Failed to verify field' });
    }
});

// PUT /api/pif/data/:clientId/verify-bulk — Bulk verify multiple fields
router.put('/data/:clientId/verify-bulk', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const { fields } = req.body;
        if (!Array.isArray(fields)) return res.status(400).json({ error: 'fields array is required' });

        const { logAudit } = require('../middleware/audit');

        for (const f of fields) {
            const existing = await prepareGet(
                'SELECT * FROM pif_field_verifications WHERE client_id = ? AND field_key = ?',
                clientId, f.field_key
            );
            if (existing) {
                await prepareRun(
                    `UPDATE pif_field_verifications SET verified = ?, comment = ?, verified_by = ?, verified_at = NOW()
                     WHERE client_id = ? AND field_key = ?`,
                    f.verified !== undefined ? f.verified : existing.verified,
                    f.comment !== undefined ? f.comment : existing.comment,
                    req.user?.id || null,
                    clientId, f.field_key
                );
            } else {
                await prepareRun(
                    `INSERT INTO pif_field_verifications (client_id, field_key, verified, comment, verified_by)
                     VALUES (?, ?, ?, ?, ?)`,
                    clientId, f.field_key, f.verified || false, f.comment || null, req.user?.id || null
                );
            }
            await logAudit(req, {
                clientId, entityType: 'verification', action: f.verified ? 'verify' : 'flag',
                fieldKey: f.field_key, oldValue: existing ? String(existing.verified) : null, newValue: String(f.verified || false),
            });
        }

        res.json({ success: true, count: fields.length });
    } catch (err) {
        console.error('Error bulk verifying fields:', err);
        res.status(500).json({ error: 'Failed to bulk verify' });
    }
});

// GET /api/pif/data/:clientId/verification-summary — Summary stats
router.get('/data/:clientId/verification-summary', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const result = await prepareGet(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN verified = true THEN 1 END) as verified,
                   COUNT(CASE WHEN verified = false AND comment IS NOT NULL AND comment != '' THEN 1 END) as flagged
            FROM pif_field_verifications WHERE client_id = ?
        `, clientId);

        res.json({
            total: parseInt(result?.total || 0),
            verified: parseInt(result?.verified || 0),
            flagged: parseInt(result?.flagged || 0),
            unverified: parseInt(result?.total || 0) - parseInt(result?.verified || 0),
        });
    } catch (err) {
        console.error('Error fetching verification summary:', err);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

// POST /api/pif/data/:clientId/send-reverification — Admin sends re-verification email to client
router.post('/data/:clientId/send-reverification', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);

        // Find latest pending/sent reverification request
        const request = await prepareGet(
            `SELECT id, changed_fields FROM pif_reverification_requests WHERE client_id = ? AND status IN ('pending') ORDER BY created_at DESC LIMIT 1`,
            clientId
        );
        if (!request) {
            return res.status(404).json({ error: 'No pending re-verification request found. Save changes first.' });
        }

        const client = await prepareGet('SELECT id, first_name, last_name, email, form_token FROM clients WHERE id = ?', clientId);
        if (!client || !client.email) {
            return res.status(400).json({ error: 'Client not found or has no email address' });
        }

        // Generate form_token if missing
        if (!client.form_token) {
            const { v4: uuidv4 } = require('uuid');
            const token = uuidv4();
            await prepareRun('UPDATE clients SET form_token = ? WHERE id = ?', token, clientId);
            client.form_token = token;
        }

        const changedFields = typeof request.changed_fields === 'string' ? JSON.parse(request.changed_fields) : request.changed_fields;
        const changeCount = Object.keys(changedFields).length;

        // Send re-verification email
        const { sendPIFReverificationEmail } = require('../services/emailService');
        const clientName = `${client.first_name} ${client.last_name}`;
        await sendPIFReverificationEmail(client.email, clientName, client.form_token, changeCount);

        // Update request status
        await prepareRun(`UPDATE pif_reverification_requests SET status = 'sent' WHERE id = ?`, request.id);

        // Update client PIF status
        await prepareRun(`UPDATE clients SET pif_status = 'pending_reverification', updated_at = NOW() WHERE id = ?`, clientId);

        console.log(`Re-verification email sent to ${clientName} (${client.email}) — ${changeCount} fields changed`);
        res.json({ success: true, message: `Re-verification request sent to ${client.email}` });
    } catch (err) {
        console.error('Error sending re-verification:', err);
        res.status(500).json({ error: 'Failed to send re-verification request' });
    }
});

// GET /api/pif/data/:clientId/reverification-history — Admin fetches re-verification history
router.get('/data/:clientId/reverification-history', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const rows = await prepareAll(
            `SELECT r.*, u.name as changed_by_name
             FROM pif_reverification_requests r
             LEFT JOIN users u ON r.changed_by = u.id
             WHERE r.client_id = ?
             ORDER BY r.created_at DESC`,
            clientId
        );

        const history = rows.map(r => ({
            id: r.id,
            changed_fields: typeof r.changed_fields === 'string' ? JSON.parse(r.changed_fields) : r.changed_fields,
            changed_by_name: r.changed_by_name || 'Unknown',
            status: r.status,
            consent_given: r.consent_given,
            consent_at: r.consent_at,
            created_at: r.created_at,
            responded_at: r.responded_at,
        }));

        res.json(history);
    } catch (err) {
        console.error('Error fetching reverification history:', err);
        res.status(500).json({ error: 'Failed to fetch history' });
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

        // Auto-task: mark PIF follow-up tasks as done
        try {
            const clientName = `${client.first_name} ${client.last_name}`;
            await completeWorkflowTask(client.id, `Follow up on PIF submission — ${clientName}`);
        } catch (e) { console.error('Auto-task completion failed:', e.message); }

        console.log(`PIF submission received for ${client.first_name} ${client.last_name} (ID: ${client.id})`);
        res.json({ success: true, message: 'Personal Information Form submitted successfully' });
    } catch (err) {
        console.error('Error saving PIF submission:', err);
        res.status(500).json({ error: 'Failed to save form submission' });
    }
});

// GET /api/pif/:token/reverification — Client fetches pending changes to review
router.get('/:token/reverification', async (req, res) => {
    try {
        const { token } = req.params;
        const client = await prepareGet('SELECT id FROM clients WHERE form_token = ?', token);
        if (!client) return res.status(404).json({ error: 'Invalid or expired form link' });

        const request = await prepareGet(
            `SELECT id, changed_fields, created_at FROM pif_reverification_requests WHERE client_id = ? AND status = 'sent' ORDER BY created_at DESC LIMIT 1`,
            client.id
        );

        if (!request) {
            return res.json({ has_reverification: false });
        }

        const submission = await prepareGet('SELECT form_data FROM pif_submissions WHERE client_id = ?', client.id);
        const currentData = submission ? JSON.parse(submission.form_data) : {};

        res.json({
            has_reverification: true,
            reverification_id: request.id,
            changed_fields: typeof request.changed_fields === 'string' ? JSON.parse(request.changed_fields) : request.changed_fields,
            current_data: currentData,
            created_at: request.created_at,
        });
    } catch (err) {
        console.error('Error fetching reverification:', err);
        res.status(500).json({ error: 'Failed to load re-verification data' });
    }
});

// POST /api/pif/:token/reverification — Client submits reviewed data + consent
router.post('/:token/reverification', async (req, res) => {
    try {
        const { token } = req.params;
        const client = await prepareGet('SELECT id, first_name, last_name FROM clients WHERE form_token = ?', token);
        if (!client) return res.status(404).json({ error: 'Invalid or expired form link' });

        const { reverification_id, form_data, consent } = req.body;
        if (!consent) {
            return res.status(400).json({ error: 'You must provide consent to submit.' });
        }
        if (!form_data || !reverification_id) {
            return res.status(400).json({ error: 'Missing form data or reverification ID.' });
        }

        // Update the PIF submission data
        form_data.consent = true;
        await prepareRun(
            'UPDATE pif_submissions SET form_data = ?, updated_at = NOW() WHERE client_id = ?',
            JSON.stringify(form_data), client.id
        );

        // Mark reverification request as confirmed
        await prepareRun(
            `UPDATE pif_reverification_requests SET status = 'confirmed', consent_given = true, consent_at = NOW(), responded_at = NOW() WHERE id = ? AND client_id = ?`,
            reverification_id, client.id
        );

        // Restore PIF status to completed
        await prepareRun(`UPDATE clients SET pif_status = 'completed', updated_at = NOW() WHERE id = ?`, client.id);

        console.log(`Re-verification confirmed by ${client.first_name} ${client.last_name} (ID: ${client.id})`);
        res.json({ success: true, message: 'Changes reviewed and consent provided successfully.' });
    } catch (err) {
        console.error('Error processing reverification:', err);
        res.status(500).json({ error: 'Failed to process re-verification' });
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
