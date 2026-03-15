const express = require('express');
const router = express.Router();
const { prepareAll, prepareRun } = require('../database');

// GET /api/clients/:id/deadlines — list deadlines for a client
router.get('/clients/:id/deadlines', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const deadlines = await prepareAll(
      'SELECT * FROM client_deadlines WHERE client_id = ? ORDER BY deadline_date ASC',
      clientId
    );
    res.json(deadlines);
  } catch (err) {
    console.error('Error fetching deadlines:', err);
    res.status(500).json({ error: 'Failed to fetch deadlines' });
  }
});

// POST /api/clients/:id/deadlines — create a deadline
router.post('/clients/:id/deadlines', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const { title, deadline_date, category, reminder_days, notes } = req.body;

    if (!title || !deadline_date) {
      return res.status(400).json({ error: 'Title and deadline_date are required' });
    }

    const result = await prepareRun(
      `INSERT INTO client_deadlines (client_id, title, deadline_date, category, reminder_days, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      clientId, title, deadline_date, category || 'general', reminder_days || 7, notes || null
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Deadline created' });
  } catch (err) {
    console.error('Error creating deadline:', err);
    res.status(500).json({ error: 'Failed to create deadline' });
  }
});

// PUT /api/deadlines/:id — update a deadline
router.put('/deadlines/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, deadline_date, category, status, reminder_days, notes } = req.body;

    await prepareRun(
      `UPDATE client_deadlines SET
        title = COALESCE(?, title),
        deadline_date = COALESCE(?, deadline_date),
        category = COALESCE(?, category),
        status = COALESCE(?, status),
        reminder_days = COALESCE(?, reminder_days),
        notes = COALESCE(?, notes)
      WHERE id = ?`,
      title || null, deadline_date || null, category || null,
      status || null, reminder_days || null, notes || null, id
    );

    res.json({ message: 'Deadline updated' });
  } catch (err) {
    console.error('Error updating deadline:', err);
    res.status(500).json({ error: 'Failed to update deadline' });
  }
});

// DELETE /api/deadlines/:id — delete a deadline
router.delete('/deadlines/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prepareRun('DELETE FROM client_deadlines WHERE id = ?', id);
    res.json({ message: 'Deadline deleted' });
  } catch (err) {
    console.error('Error deleting deadline:', err);
    res.status(500).json({ error: 'Failed to delete deadline' });
  }
});

// GET /api/deadlines/upcoming — cross-client, next 90 days
router.get('/deadlines/upcoming', async (req, res) => {
  try {
    const deadlines = await prepareAll(
      `SELECT d.*, c.first_name, c.last_name, c.visa_type
       FROM client_deadlines d
       JOIN clients c ON d.client_id = c.id
       WHERE d.deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
         AND d.status = 'pending'
       ORDER BY d.deadline_date ASC`
    );
    res.json(deadlines);
  } catch (err) {
    console.error('Error fetching upcoming deadlines:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming deadlines' });
  }
});

module.exports = router;
