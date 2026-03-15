const express = require('express');
const router = express.Router();
const { prepareAll, prepareRun } = require('../database');

// GET /api/clients/:id/timeline — unified timeline across all tables
router.get('/clients/:id/timeline', async (req, res) => {
  try {
    const clientId = req.params.id;
    const rows = await prepareAll(`
      SELECT * FROM (
        SELECT id, client_id, event_type, title, description, metadata, created_by, created_at
        FROM client_timeline
        WHERE client_id = ?

        UNION ALL

        SELECT id, client_id, 'document_upload' AS event_type,
          'Document uploaded: ' || original_name AS title,
          'Category: ' || COALESCE(category, 'general') AS description,
          NULL AS metadata, COALESCE(source, 'admin') AS created_by, uploaded_at AS created_at
        FROM documents
        WHERE client_id = ?

        UNION ALL

        SELECT id, client_id, 'form_upload' AS event_type,
          'Form uploaded: ' || original_name AS title,
          field_count || ' fields detected' AS description,
          NULL AS metadata, 'admin' AS created_by, uploaded_at AS created_at
        FROM forms
        WHERE client_id = ?

        UNION ALL

        SELECT ff.id, ff.client_id, 'form_filled' AS event_type,
          'Form auto-filled: ' || COALESCE(ff.original_form_name, 'Unknown') AS title,
          NULL AS description,
          NULL AS metadata, 'system' AS created_by, ff.filled_at AS created_at
        FROM filled_forms ff
        WHERE ff.client_id = ?

        UNION ALL

        SELECT id, client_id, 'pif_submitted' AS event_type,
          'Personal Information Form submitted' AS title,
          NULL AS description,
          NULL AS metadata, 'client' AS created_by, submitted_at AS created_at
        FROM pif_submissions
        WHERE client_id = ?

        UNION ALL

        SELECT id, client_id, 'note' AS event_type,
          CASE WHEN is_pinned THEN '📌 ' ELSE '' END || 'Note by ' || COALESCE(author, 'Admin') AS title,
          content AS description,
          NULL AS metadata, author AS created_by, created_at
        FROM client_notes
        WHERE client_id = ?
      ) AS timeline
      ORDER BY created_at DESC
    `, clientId, clientId, clientId, clientId, clientId, clientId);

    res.json(rows);
  } catch (err) {
    console.error('Timeline fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// POST /api/clients/:id/timeline — add a manual timeline event
router.post('/clients/:id/timeline', async (req, res) => {
  try {
    const { event_type, title, description, metadata, created_by } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      req.params.id, event_type || 'manual', title, description || null,
      metadata ? JSON.stringify(metadata) : null, created_by || 'Admin'
    );
    res.json({ id: result.lastInsertRowid, message: 'Event added' });
  } catch (err) {
    console.error('Timeline insert error:', err);
    res.status(500).json({ error: 'Failed to add timeline event' });
  }
});

// GET /api/timeline/recent — cross-client recent activity
router.get('/timeline/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const rows = await prepareAll(`
      SELECT t.*, c.first_name, c.last_name
      FROM (
        SELECT id, client_id, event_type, title, description, created_by, created_at
        FROM client_timeline

        UNION ALL

        SELECT id, client_id, 'document_upload' AS event_type,
          'Document uploaded: ' || original_name AS title,
          'Category: ' || COALESCE(category, 'general') AS description,
          COALESCE(source, 'admin') AS created_by, uploaded_at AS created_at
        FROM documents

        UNION ALL

        SELECT id, client_id, 'note' AS event_type,
          'Note added' AS title, content AS description,
          author AS created_by, created_at
        FROM client_notes
      ) t
      JOIN clients c ON c.id = t.client_id
      ORDER BY t.created_at DESC
      LIMIT ?
    `, limit);
    res.json(rows);
  } catch (err) {
    console.error('Recent timeline error:', err);
    res.status(500).json({ error: 'Failed to fetch recent timeline' });
  }
});

module.exports = router;
