const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/clients/:id/notes
router.get('/clients/:id/notes', async (req, res) => {
  try {
    const rows = await prepareAll(
      'SELECT * FROM client_notes WHERE client_id = ? ORDER BY is_pinned DESC, created_at DESC',
      req.params.id
    );
    res.json(rows);
  } catch (err) {
    console.error('Notes fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/clients/:id/notes
router.post('/clients/:id/notes', async (req, res) => {
  try {
    const { content, author } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

    const result = await prepareRun(
      'INSERT INTO client_notes (client_id, content, author) VALUES (?, ?, ?)',
      req.params.id, content.trim(), author || 'Admin'
    );
    res.json({ id: result.lastInsertRowid, message: 'Note added' });
  } catch (err) {
    console.error('Note insert error:', err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// PUT /api/notes/:id
router.put('/notes/:id', async (req, res) => {
  try {
    const { content, is_pinned } = req.body;
    const updates = [];
    const params = [];

    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (is_pinned !== undefined) { updates.push('is_pinned = ?'); params.push(is_pinned); }
    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    await prepareRun(
      `UPDATE client_notes SET ${updates.join(', ')} WHERE id = ?`,
      ...params
    );
    res.json({ message: 'Note updated' });
  } catch (err) {
    console.error('Note update error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id
router.delete('/notes/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM client_notes WHERE id = ?', req.params.id);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('Note delete error:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
