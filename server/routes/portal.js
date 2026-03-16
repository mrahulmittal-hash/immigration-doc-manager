const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { createMulterStorage } = require('../services/storageService');

const { storage: portalStorage } = createMulterStorage('portal-uploads', 'portal-uploads');
const portalUpload = multer({
  storage: portalStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// Helper: validate token and return client
async function getClientByToken(token) {
  const client = await prepareGet(
    'SELECT id, first_name, last_name, email, visa_type, status, pipeline_stage, pif_status FROM clients WHERE form_token = ?',
    token
  );
  return client;
}

// GET /api/portal/:token — Client info + status
router.get('/:token', async (req, res) => {
  try {
    const client = await getClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid portal link' });

    res.json({
      client_name: `${client.first_name} ${client.last_name}`,
      visa_type: client.visa_type,
      pipeline_stage: client.pipeline_stage,
      pif_status: client.pif_status,
      status: client.status,
    });
  } catch (err) {
    console.error('Portal info error:', err);
    res.status(500).json({ error: 'Failed to load portal' });
  }
});

// GET /api/portal/:token/status — Pipeline progress with stage descriptions
router.get('/:token/status', async (req, res) => {
  try {
    const client = await getClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid portal link' });

    const stages = [
      { id: 'lead', label: 'Application Received', description: 'Your application has been received by our office' },
      { id: 'consultation', label: 'Consultation', description: 'Initial consultation and eligibility assessment' },
      { id: 'retainer_signed', label: 'Retainer Signed', description: 'Retainer agreement signed and account activated' },
      { id: 'in_progress', label: 'In Progress', description: 'Documents being collected and forms being prepared' },
      { id: 'submitted', label: 'Submitted', description: 'Application submitted to IRCC' },
      { id: 'approved', label: 'Approved', description: 'Application approved — congratulations!' },
    ];

    const currentIdx = stages.findIndex(s => s.id === client.pipeline_stage);
    const stagesWithStatus = stages.map((s, i) => ({
      ...s,
      completed: i < currentIdx,
      current: i === currentIdx,
    }));

    res.json({ stages: stagesWithStatus, current_stage: client.pipeline_stage });
  } catch (err) {
    console.error('Portal status error:', err);
    res.status(500).json({ error: 'Failed to load status' });
  }
});

// GET /api/portal/:token/checklist — Document checklist with statuses
router.get('/:token/checklist', async (req, res) => {
  try {
    const client = await getClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid portal link' });

    const items = await prepareAll(
      `SELECT cs.id, cs.status, cs.notes, dc.document_name, dc.is_required, dc.description, dc.category,
              d.original_name as uploaded_filename, d.uploaded_at
       FROM client_checklist_status cs
       JOIN document_checklists dc ON dc.id = cs.checklist_id
       LEFT JOIN documents d ON d.id = cs.document_id
       WHERE cs.client_id = ?
       ORDER BY dc.category, dc.document_name`,
      client.id
    );

    // Group by category
    const grouped = {};
    for (const item of items) {
      const cat = item.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    const total = items.length;
    const completed = items.filter(i => i.status === 'uploaded' || i.status === 'waived').length;

    res.json({ items, grouped, total, completed, progress: total > 0 ? Math.round(completed / total * 100) : 0 });
  } catch (err) {
    console.error('Portal checklist error:', err);
    res.status(500).json({ error: 'Failed to load checklist' });
  }
});

// GET /api/portal/:token/documents — List client-uploaded documents
router.get('/:token/documents', async (req, res) => {
  try {
    const client = await getClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid portal link' });

    const docs = await prepareAll(
      "SELECT id, original_name, file_type, file_size, category, source, uploaded_at FROM documents WHERE client_id = ? AND source IN ('pif-upload', 'portal-upload') ORDER BY uploaded_at DESC",
      client.id
    );
    res.json(docs);
  } catch (err) {
    console.error('Portal documents error:', err);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

// POST /api/portal/:token/documents — Upload documents from portal
router.post('/:token/documents', portalUpload.array('files', 10), async (req, res) => {
  try {
    const client = await getClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid portal link' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { checklist_item_id, category } = req.body;
    const results = [];

    for (const file of req.files) {
      const filePath = file.key || file.path || path.join('uploads', 'portal-uploads', file.filename);
      const ext = path.extname(file.originalname).toLowerCase();

      const result = await prepareRun(
        `INSERT INTO documents (client_id, filename, original_name, file_path, file_type, file_size, category, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'portal-upload')`,
        client.id, file.filename, file.originalname, filePath, ext, file.size, category || 'general'
      );

      const docId = result.lastID || result.id;
      results.push({ id: docId, filename: file.originalname });

      // If linked to a checklist item, update its status
      if (checklist_item_id) {
        await prepareRun(
          "UPDATE client_checklist_status SET status = 'uploaded', document_id = ? WHERE id = ? AND client_id = ?",
          docId, checklist_item_id, client.id
        );
      }

      // Timeline event
      await prepareRun(
        `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
         VALUES (?, 'document_upload', 'Document uploaded via portal', ?, 'Client')`,
        client.id, file.originalname
      );
    }

    res.json({ success: true, documents: results });
  } catch (err) {
    console.error('Portal upload error:', err);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// DELETE /api/portal/:token/documents/:docId — Delete own upload
router.delete('/:token/documents/:docId', async (req, res) => {
  try {
    const client = await getClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid portal link' });

    // Only allow deleting portal-uploaded docs
    const doc = await prepareGet(
      "SELECT id FROM documents WHERE id = ? AND client_id = ? AND source = 'portal-upload'",
      req.params.docId, client.id
    );
    if (!doc) return res.status(404).json({ error: 'Document not found or cannot be deleted' });

    await prepareRun('DELETE FROM documents WHERE id = ?', doc.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Portal delete error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/portal/:token/timeline — Filtered timeline (client-visible events only)
router.get('/:token/timeline', async (req, res) => {
  try {
    const client = await getClientByToken(req.params.token);
    if (!client) return res.status(404).json({ error: 'Invalid portal link' });

    const events = await prepareAll(
      `SELECT id, event_type, title, description, created_at
       FROM client_timeline
       WHERE client_id = ? AND event_type IN (
         'document_upload', 'pif_submitted', 'form_filled', 'stage_change',
         'document_signed', 'signature_requested', 'checklist_initialized',
         'ocr_extraction', 'ircc_forms_generated'
       )
       ORDER BY created_at DESC LIMIT 50`,
      client.id
    );
    res.json(events);
  } catch (err) {
    console.error('Portal timeline error:', err);
    res.status(500).json({ error: 'Failed to load timeline' });
  }
});

module.exports = router;
