const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/retainers — list all retainers (for finance page)
router.get('/retainers', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT r.*, c.first_name, c.last_name, c.email, c.visa_type
               FROM retainers r JOIN clients c ON c.id = r.client_id`;
    const params = [];
    if (status) { params.push(status); sql += ' WHERE r.status = ?'; }
    sql += ' ORDER BY r.created_at DESC';
    const rows = await prepareAll(sql, ...params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching retainers:', err);
    res.status(500).json({ error: 'Failed to fetch retainers' });
  }
});

// GET /api/clients/:id/retainers — client-specific retainers
router.get('/clients/:id/retainers', async (req, res) => {
  try {
    const rows = await prepareAll(
      'SELECT * FROM retainers WHERE client_id = ? ORDER BY created_at DESC',
      req.params.id
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client retainers' });
  }
});

// POST /api/clients/:id/retainers — create retainer for client
router.post('/clients/:id/retainers', async (req, res) => {
  try {
    const { service_type, retainer_fee, due_date, signed_date, notes } = req.body;
    const result = await prepareRun(
      `INSERT INTO retainers (client_id, service_type, retainer_fee, due_date, signed_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      req.params.id, service_type, retainer_fee, due_date || null, signed_date || null, notes || null
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Retainer created' });
  } catch (err) {
    console.error('Error creating retainer:', err);
    res.status(500).json({ error: 'Failed to create retainer' });
  }
});

// PUT /api/retainers/:id — update retainer
router.put('/retainers/:id', async (req, res) => {
  try {
    const fields = ['service_type','retainer_fee','due_date','signed_date','notes','status'];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (sets.length === 0) return res.json({ message: 'Nothing to update' });
    sets.push('updated_at = NOW()');
    params.push(req.params.id);
    await prepareRun(`UPDATE retainers SET ${sets.join(', ')} WHERE id = ?`, ...params);
    res.json({ message: 'Retainer updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update retainer' });
  }
});

// DELETE /api/retainers/:id
router.delete('/retainers/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM retainers WHERE id = ?', req.params.id);
    res.json({ message: 'Retainer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete retainer' });
  }
});

// ── Payments ─────────────────────────────────────────────────

// GET /api/retainers/:id/payments
router.get('/retainers/:id/payments', async (req, res) => {
  try {
    const rows = await prepareAll(
      'SELECT * FROM payments WHERE retainer_id = ? ORDER BY payment_date DESC',
      req.params.id
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/retainers/:id/payments — record payment + recalc retainer
router.post('/retainers/:id/payments', async (req, res) => {
  try {
    const retainer = await prepareGet('SELECT * FROM retainers WHERE id = ?', req.params.id);
    if (!retainer) return res.status(404).json({ error: 'Retainer not found' });

    const { amount, payment_method, payment_date, reference_number, notes } = req.body;
    await prepareRun(
      `INSERT INTO payments (retainer_id, client_id, amount, payment_method, payment_date, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      req.params.id, retainer.client_id, amount, payment_method || null,
      payment_date || new Date().toISOString().split('T')[0], reference_number || null, notes || null
    );

    // Recalculate amount_paid and status
    const total = await prepareGet(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE retainer_id = ?',
      req.params.id
    );
    const paid = parseFloat(total.total);
    const fee = parseFloat(retainer.retainer_fee);
    let status = 'pending';
    if (paid >= fee) status = 'paid';
    else if (paid > 0) status = 'partial';

    await prepareRun(
      'UPDATE retainers SET amount_paid = ?, status = ?, updated_at = NOW() WHERE id = ?',
      paid, status, req.params.id
    );

    res.status(201).json({ message: 'Payment recorded', amount_paid: paid, status });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// DELETE /api/payments/:id — delete payment + recalc
router.delete('/payments/:id', async (req, res) => {
  try {
    const payment = await prepareGet('SELECT * FROM payments WHERE id = ?', req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    await prepareRun('DELETE FROM payments WHERE id = ?', req.params.id);

    // Recalculate
    const retainer = await prepareGet('SELECT * FROM retainers WHERE id = ?', payment.retainer_id);
    const total = await prepareGet(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE retainer_id = ?',
      payment.retainer_id
    );
    const paid = parseFloat(total.total);
    const fee = parseFloat(retainer.retainer_fee);
    let status = 'pending';
    if (paid >= fee) status = 'paid';
    else if (paid > 0) status = 'partial';

    await prepareRun(
      'UPDATE retainers SET amount_paid = ?, status = ?, updated_at = NOW() WHERE id = ?',
      paid, status, payment.retainer_id
    );

    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// GET /api/retainers/stats — aggregate finance stats
router.get('/retainers-stats', async (req, res) => {
  try {
    const stats = await prepareGet(`
      SELECT
        COALESCE(SUM(amount_paid), 0) AS total_collected,
        COALESCE(SUM(retainer_fee - amount_paid), 0) AS total_outstanding,
        COALESCE(SUM(retainer_fee), 0) AS total_billed,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
        COUNT(*) FILTER (WHERE status = 'overdue' OR (status != 'paid' AND due_date < CURRENT_DATE)) AS overdue_count,
        COUNT(*) AS total_count
      FROM retainers
    `);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch retainer stats' });
  }
});

module.exports = router;
