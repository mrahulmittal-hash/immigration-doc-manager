const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/clients/:id/family
router.get('/clients/:id/family', async (req, res) => {
  try {
    const members = await prepareAll(
      'SELECT * FROM family_members WHERE client_id = ? ORDER BY created_at DESC',
      parseInt(req.params.id)
    );
    res.json(members);
  } catch (err) {
    console.error('Error fetching family members:', err);
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// POST /api/clients/:id/family
router.post('/clients/:id/family', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const { relationship, first_name, last_name, date_of_birth, nationality, passport_number, immigration_status, notes } = req.body;

    if (!relationship || !first_name || !last_name) {
      return res.status(400).json({ error: 'Relationship, first name, and last name are required' });
    }

    const result = await prepareRun(
      `INSERT INTO family_members (client_id, relationship, first_name, last_name, date_of_birth, nationality, passport_number, immigration_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      clientId, relationship, first_name, last_name,
      date_of_birth || null, nationality || null, passport_number || null,
      immigration_status || null, notes || null
    );

    const member = await prepareGet('SELECT * FROM family_members WHERE id = ?', result.lastInsertRowid);
    res.status(201).json(member);
  } catch (err) {
    console.error('Error adding family member:', err);
    res.status(500).json({ error: 'Failed to add family member' });
  }
});

// PUT /api/family/:id
router.put('/family/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prepareGet('SELECT * FROM family_members WHERE id = ?', id);
    if (!existing) return res.status(404).json({ error: 'Family member not found' });

    const { relationship, first_name, last_name, date_of_birth, nationality, passport_number, immigration_status, notes } = req.body;
    await prepareRun(
      `UPDATE family_members SET relationship = ?, first_name = ?, last_name = ?, date_of_birth = ?, nationality = ?, passport_number = ?, immigration_status = ?, notes = ?
       WHERE id = ?`,
      relationship || existing.relationship,
      first_name || existing.first_name,
      last_name || existing.last_name,
      date_of_birth !== undefined ? date_of_birth : existing.date_of_birth,
      nationality !== undefined ? nationality : existing.nationality,
      passport_number !== undefined ? passport_number : existing.passport_number,
      immigration_status !== undefined ? immigration_status : existing.immigration_status,
      notes !== undefined ? notes : existing.notes,
      id
    );

    const updated = await prepareGet('SELECT * FROM family_members WHERE id = ?', id);
    res.json(updated);
  } catch (err) {
    console.error('Error updating family member:', err);
    res.status(500).json({ error: 'Failed to update family member' });
  }
});

// DELETE /api/family/:id
router.delete('/family/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prepareRun('DELETE FROM family_members WHERE id = ?', id);
    res.json({ message: 'Family member deleted' });
  } catch (err) {
    console.error('Error deleting family member:', err);
    res.status(500).json({ error: 'Failed to delete family member' });
  }
});

module.exports = router;
