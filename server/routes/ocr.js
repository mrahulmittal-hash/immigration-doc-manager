const express = require('express');
const router = express.Router();
const { prepareGet, prepareRun, prepareAll } = require('../database');
const { processPassport } = require('../services/ocrService');
const path = require('path');

// POST /api/documents/:id/ocr — Run OCR on a document (passport/visa image)
router.post('/documents/:id/ocr', async (req, res) => {
  try {
    const doc = await prepareGet('SELECT * FROM documents WHERE id = ?', req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Validate file type is an image
    const ext = path.extname(doc.original_name || doc.filename).toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp'];
    if (!imageExts.includes(ext)) {
      return res.status(400).json({ error: 'OCR requires an image file (PNG, JPG, TIFF, BMP)' });
    }

    // Resolve file path
    let filePath = doc.file_path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(__dirname, '..', filePath);
    }

    const result = await processPassport(filePath);

    res.json({
      document_id: doc.id,
      client_id: doc.client_id,
      fields: result.fields,
      raw_text: result.raw_text,
      confidence: result.confidence,
      method: result.method,
    });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: `OCR failed: ${err.message}` });
  }
});

// POST /api/documents/:id/ocr/confirm — Save OCR-extracted fields to client_data + optionally update clients
router.post('/documents/:id/ocr/confirm', async (req, res) => {
  try {
    const doc = await prepareGet('SELECT * FROM documents WHERE id = ?', req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const { fields, update_client } = req.body;
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'Fields object required' });
    }

    const clientId = doc.client_id;
    let savedCount = 0;

    // Save each field to client_data
    for (const [key, value] of Object.entries(fields)) {
      if (!value || value.toString().trim() === '') continue;

      // Upsert: delete old OCR entry for this key, then insert new
      await prepareRun(
        "DELETE FROM client_data WHERE client_id = ? AND field_key = ? AND source = 'ocr'",
        clientId, key
      );
      await prepareRun(
        "INSERT INTO client_data (client_id, field_key, field_value, source) VALUES (?, ?, ?, 'ocr')",
        clientId, key, value.toString().trim()
      );
      savedCount++;
    }

    // Optionally update the clients table directly
    if (update_client) {
      const updates = {};
      if (fields.passport_number) updates.passport_number = fields.passport_number;
      if (fields.date_of_birth) updates.date_of_birth = fields.date_of_birth;
      if (fields.nationality_full || fields.nationality) updates.nationality = fields.nationality_full || fields.nationality;
      if (fields.first_name && fields.last_name) {
        updates.first_name = fields.first_name;
        updates.last_name = fields.last_name;
      }

      const setClauses = Object.entries(updates).map(([k], i) => `${k} = $${i + 1}`);
      if (setClauses.length > 0) {
        const vals = Object.values(updates);
        vals.push(clientId);
        await prepareRun(
          `UPDATE clients SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`,
          ...vals
        );
      }
    }

    // Add timeline event
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'ocr_extraction', 'Passport OCR completed', ?, 'System')`,
      clientId,
      `${savedCount} fields extracted from ${doc.original_name || doc.filename}`
    );

    res.json({ success: true, saved_count: savedCount });
  } catch (err) {
    console.error('OCR confirm error:', err);
    res.status(500).json({ error: `Failed to save OCR data: ${err.message}` });
  }
});

module.exports = router;
