const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { createMulterStorage, deleteFromS3, getDownloadUrl, isS3Enabled } = require('../services/storageService');

// ── Multer for immigration photos ────────────────────────────
const { storage } = createMulterStorage('photos', 'photos');
const photoUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: JPG, PNG, BMP, TIFF'));
  }
});

// ══════════════════════════════════════════════════════════════
// DEPENDENTS
// ══════════════════════════════════════════════════════════════

// GET /api/clients/:clientId/dependents
router.get('/clients/:clientId/dependents', async (req, res) => {
  try {
    const rows = await prepareAll(
      'SELECT * FROM dependents WHERE client_id = ? ORDER BY created_at ASC',
      parseInt(req.params.clientId)
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching dependents:', err);
    res.status(500).json({ error: 'Failed to fetch dependents' });
  }
});

// POST /api/clients/:clientId/dependents
router.post('/clients/:clientId/dependents', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { first_name, last_name, relationship, date_of_birth, nationality, passport_number, email, phone, gender, marital_status, notes } = req.body;
    if (!first_name || !last_name || !relationship) {
      return res.status(400).json({ error: 'first_name, last_name, and relationship are required' });
    }
    const result = await prepareRun(
      `INSERT INTO dependents (client_id, first_name, last_name, relationship, date_of_birth, nationality, passport_number, email, phone, gender, marital_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      clientId, first_name, last_name, relationship,
      date_of_birth || null, nationality || null, passport_number || null,
      email || null, phone || null, gender || null, marital_status || null, notes || null
    );
    const dep = await prepareGet('SELECT * FROM dependents WHERE id = ?', result.lastInsertRowid);
    res.status(201).json(dep);
  } catch (err) {
    console.error('Error creating dependent:', err);
    res.status(500).json({ error: 'Failed to create dependent' });
  }
});

// PUT /api/dependents/:id
router.put('/dependents/:id', async (req, res) => {
  try {
    const fields = ['first_name','last_name','relationship','date_of_birth','nationality','passport_number','email','phone','gender','marital_status','notes'];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (sets.length === 0) return res.json({ message: 'Nothing to update' });
    sets.push('updated_at = NOW()');
    params.push(parseInt(req.params.id));
    await prepareRun(`UPDATE dependents SET ${sets.join(', ')} WHERE id = ?`, ...params);
    const dep = await prepareGet('SELECT * FROM dependents WHERE id = ?', parseInt(req.params.id));
    res.json(dep);
  } catch (err) {
    console.error('Error updating dependent:', err);
    res.status(500).json({ error: 'Failed to update dependent' });
  }
});

// DELETE /api/dependents/:id
router.delete('/dependents/:id', async (req, res) => {
  try {
    // Delete associated photos first
    const photos = await prepareAll('SELECT * FROM immigration_photos WHERE dependent_id = ?', parseInt(req.params.id));
    for (const p of photos) {
      if (p.file_path && p.file_path.startsWith('s3://')) {
        const key = p.file_path.replace(`s3://${process.env.S3_BUCKET_NAME}/`, '');
        await deleteFromS3(key);
      } else if (fs.existsSync(p.file_path)) {
        fs.unlinkSync(p.file_path);
      }
    }
    await prepareRun('DELETE FROM dependents WHERE id = ?', parseInt(req.params.id));
    res.json({ message: 'Dependent deleted' });
  } catch (err) {
    console.error('Error deleting dependent:', err);
    res.status(500).json({ error: 'Failed to delete dependent' });
  }
});

// ══════════════════════════════════════════════════════════════
// IMMIGRATION PHOTOS
// ══════════════════════════════════════════════════════════════

// GET /api/clients/:clientId/photos — all photos for client + dependents
router.get('/clients/:clientId/photos', async (req, res) => {
  try {
    const rows = await prepareAll(
      `SELECT ip.*, d.first_name AS dep_first_name, d.last_name AS dep_last_name, d.relationship
       FROM immigration_photos ip
       LEFT JOIN dependents d ON d.id = ip.dependent_id
       WHERE ip.client_id = ?
       ORDER BY ip.person_type ASC, ip.uploaded_at DESC`,
      parseInt(req.params.clientId)
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Failed to fetch immigration photos' });
  }
});

// POST /api/clients/:clientId/photos — upload photo for client or dependent
router.post('/clients/:clientId/photos', photoUpload.single('photo'), async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { dependent_id, person_name, person_type, notes } = req.body;

    const storedPath = isS3Enabled()
      ? `s3://${process.env.S3_BUCKET_NAME}/${req.file.key}`
      : req.file.path;
    const filename = isS3Enabled() ? req.file.key : req.file.filename;

    const result = await prepareRun(
      `INSERT INTO immigration_photos (client_id, dependent_id, person_name, person_type, filename, original_name, file_path, file_size, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      clientId, dependent_id ? parseInt(dependent_id) : null,
      person_name || 'Client', person_type || 'client',
      filename, req.file.originalname, storedPath, req.file.size, notes || null
    );
    const photo = await prepareGet('SELECT * FROM immigration_photos WHERE id = ?', result.lastInsertRowid);
    res.status(201).json(photo);
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ error: 'Failed to upload immigration photo' });
  }
});

// GET /api/photos/:id/download
router.get('/photos/:id/download', async (req, res) => {
  try {
    const photo = await prepareGet('SELECT * FROM immigration_photos WHERE id = ?', parseInt(req.params.id));
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.file_path && photo.file_path.startsWith('s3://')) {
      const url = await getDownloadUrl(photo.file_path, req);
      return res.redirect(url);
    }
    res.download(photo.file_path, photo.original_name);
  } catch (err) {
    console.error('Error downloading photo:', err);
    res.status(500).json({ error: 'Failed to download photo' });
  }
});

// PUT /api/photos/:id — update status / notes
router.put('/photos/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const sets = []; const params = [];
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
    if (sets.length === 0) return res.json({ message: 'Nothing to update' });
    params.push(parseInt(req.params.id));
    await prepareRun(`UPDATE immigration_photos SET ${sets.join(', ')} WHERE id = ?`, ...params);
    const photo = await prepareGet('SELECT * FROM immigration_photos WHERE id = ?', parseInt(req.params.id));
    res.json(photo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE /api/photos/:id
router.delete('/photos/:id', async (req, res) => {
  try {
    const photo = await prepareGet('SELECT * FROM immigration_photos WHERE id = ?', parseInt(req.params.id));
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.file_path && photo.file_path.startsWith('s3://')) {
      const key = photo.file_path.replace(`s3://${process.env.S3_BUCKET_NAME}/`, '');
      await deleteFromS3(key);
    } else if (fs.existsSync(photo.file_path)) {
      fs.unlinkSync(photo.file_path);
    }
    await prepareRun('DELETE FROM immigration_photos WHERE id = ?', parseInt(req.params.id));
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
