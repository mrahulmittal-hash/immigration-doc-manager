const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/checklists/:visaType — get checklist template items for a visa type
router.get('/checklists/:visaType', async (req, res) => {
  try {
    const visaType = decodeURIComponent(req.params.visaType);
    const items = await prepareAll(
      'SELECT * FROM document_checklists WHERE visa_type = ? ORDER BY category, document_name',
      visaType
    );
    res.json(items);
  } catch (err) {
    console.error('Error fetching checklist template:', err);
    res.status(500).json({ error: 'Failed to fetch checklist template' });
  }
});

// GET /api/clients/:id/checklist — get client's checklist status
router.get('/clients/:id/checklist', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const items = await prepareAll(
      `SELECT cs.id, cs.status, cs.document_id, cs.notes,
              dc.visa_type, dc.document_name, dc.is_required, dc.description, dc.category
       FROM client_checklist_status cs
       JOIN document_checklists dc ON cs.checklist_id = dc.id
       WHERE cs.client_id = ?
       ORDER BY dc.category, dc.document_name`,
      clientId
    );
    res.json(items);
  } catch (err) {
    console.error('Error fetching client checklist:', err);
    res.status(500).json({ error: 'Failed to fetch client checklist' });
  }
});

// PUT /api/client-checklist/:id — update checklist item status
router.put('/client-checklist/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, document_id, notes } = req.body;

    await prepareRun(
      `UPDATE client_checklist_status SET
        status = COALESCE(?, status),
        document_id = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?`,
      status || null, document_id || null, notes || null, id
    );

    res.json({ message: 'Checklist item updated' });
  } catch (err) {
    console.error('Error updating checklist item:', err);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// POST /api/clients/:id/checklist/init — initialize checklist for client
router.post('/clients/:id/checklist/init', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    // Get the client's visa type
    const client = await prepareGet('SELECT visa_type FROM clients WHERE id = ?', clientId);
    if (!client || !client.visa_type) {
      return res.status(400).json({ error: 'Client has no visa type set' });
    }

    // Check if already initialized
    const existing = await prepareAll(
      'SELECT id FROM client_checklist_status WHERE client_id = ?',
      clientId
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Checklist already initialized for this client' });
    }

    // Get checklist template items for the visa type
    const templateItems = await prepareAll(
      'SELECT id FROM document_checklists WHERE visa_type = ?',
      client.visa_type
    );

    if (templateItems.length === 0) {
      return res.status(404).json({ error: 'No checklist template found for visa type: ' + client.visa_type });
    }

    // Insert a client_checklist_status row for each template item
    for (const item of templateItems) {
      await prepareRun(
        'INSERT INTO client_checklist_status (client_id, checklist_id, status) VALUES (?, ?, ?)',
        clientId, item.id, 'missing'
      );
    }

    res.status(201).json({ message: 'Checklist initialized', items: templateItems.length });
  } catch (err) {
    console.error('Error initializing checklist:', err);
    res.status(500).json({ error: 'Failed to initialize checklist' });
  }
});

module.exports = router;
