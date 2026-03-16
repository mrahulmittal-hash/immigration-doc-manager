const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/employers — list all employers
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let sql = `SELECT e.*,
      (SELECT COUNT(*) FROM employer_clients ec WHERE ec.employer_id = e.id) AS worker_count,
      (SELECT COUNT(*) FROM lmia_applications la WHERE la.employer_id = e.id AND la.status NOT IN ('approved','refused','withdrawn')) AS active_lmia_count,
      (SELECT COALESCE(SUM(ef.amount),0) FROM employer_fees ef WHERE ef.employer_id = e.id AND ef.status = 'unpaid') AS fees_outstanding
      FROM employers e WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND e.status = ?`; }
    if (search) { params.push(`%${search}%`); sql += ` AND e.company_name ILIKE ?`; }
    sql += ` ORDER BY e.created_at DESC`;
    const rows = await prepareAll(sql, ...params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching employers:', err);
    res.status(500).json({ error: 'Failed to fetch employers' });
  }
});

// POST /api/employers — create employer
router.post('/', async (req, res) => {
  try {
    const { company_name, trade_name, business_number, contact_name, contact_email, contact_phone, address, city, province, postal_code, industry, num_employees, notes } = req.body;
    const result = await prepareRun(
      `INSERT INTO employers (company_name, trade_name, business_number, contact_name, contact_email, contact_phone, address, city, province, postal_code, industry, num_employees, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      company_name, trade_name || null, business_number || null, contact_name || null,
      contact_email || null, contact_phone || null, address || null, city || null,
      province || null, postal_code || null, industry || null, num_employees || null, notes || null
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Employer created' });
  } catch (err) {
    console.error('Error creating employer:', err);
    res.status(500).json({ error: 'Failed to create employer' });
  }
});

// GET /api/employers/:id — employer detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const employer = await prepareGet('SELECT * FROM employers WHERE id = ?', id);
    if (!employer) return res.status(404).json({ error: 'Employer not found' });

    const clients = await prepareAll(
      `SELECT ec.*, c.first_name, c.last_name, c.email, c.visa_type, c.status as client_status
       FROM employer_clients ec JOIN clients c ON c.id = ec.client_id
       WHERE ec.employer_id = ? ORDER BY ec.created_at DESC`, id
    );
    const lmias = await prepareAll(
      `SELECT la.*, c.first_name, c.last_name
       FROM lmia_applications la LEFT JOIN clients c ON c.id = la.client_id
       WHERE la.employer_id = ? ORDER BY la.created_at DESC`, id
    );
    const fees = await prepareAll(
      'SELECT * FROM employer_fees WHERE employer_id = ? ORDER BY created_at DESC', id
    );
    res.json({ ...employer, clients, lmias, fees });
  } catch (err) {
    console.error('Error fetching employer:', err);
    res.status(500).json({ error: 'Failed to fetch employer' });
  }
});

// PUT /api/employers/:id — update employer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['company_name','trade_name','business_number','contact_name','contact_email','contact_phone','address','city','province','postal_code','industry','num_employees','notes','status'];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (sets.length === 0) return res.json({ message: 'Nothing to update' });
    sets.push('updated_at = NOW()');
    params.push(id);
    await prepareRun(`UPDATE employers SET ${sets.join(', ')} WHERE id = ?`, ...params);
    res.json({ message: 'Employer updated' });
  } catch (err) {
    console.error('Error updating employer:', err);
    res.status(500).json({ error: 'Failed to update employer' });
  }
});

// DELETE /api/employers/:id
router.delete('/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM employers WHERE id = ?', req.params.id);
    res.json({ message: 'Employer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete employer' });
  }
});

// ── Employer-Client linking ──────────────────────────────────
router.get('/:id/clients', async (req, res) => {
  try {
    const rows = await prepareAll(
      `SELECT ec.*, c.first_name, c.last_name, c.email, c.visa_type
       FROM employer_clients ec JOIN clients c ON c.id = ec.client_id
       WHERE ec.employer_id = ? ORDER BY ec.created_at DESC`, req.params.id
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employer clients' });
  }
});

router.post('/:id/clients', async (req, res) => {
  try {
    const { client_id, job_title, start_date, wage, wage_type, lmia_id } = req.body;
    const result = await prepareRun(
      `INSERT INTO employer_clients (employer_id, client_id, job_title, start_date, wage, wage_type, lmia_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      req.params.id, client_id, job_title || null, start_date || null, wage || null, wage_type || 'hourly', lmia_id || null
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Client linked' });
  } catch (err) {
    console.error('Error linking client:', err);
    res.status(500).json({ error: 'Failed to link client' });
  }
});

router.delete('/:eid/clients/:cid', async (req, res) => {
  try {
    await prepareRun('DELETE FROM employer_clients WHERE employer_id = ? AND client_id = ?', req.params.eid, req.params.cid);
    res.json({ message: 'Client unlinked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink client' });
  }
});

// ── Employer Fees ────────────────────────────────────────────
router.get('/:id/fees', async (req, res) => {
  try {
    const rows = await prepareAll('SELECT * FROM employer_fees WHERE employer_id = ? ORDER BY created_at DESC', req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fees' });
  }
});

router.post('/:id/fees', async (req, res) => {
  try {
    const { description, amount, lmia_id, due_date, notes } = req.body;
    const result = await prepareRun(
      `INSERT INTO employer_fees (employer_id, lmia_id, description, amount, due_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      req.params.id, lmia_id || null, description, amount, due_date || null, notes || null
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Fee created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create fee' });
  }
});

router.put('/fees/:id', async (req, res) => {
  try {
    const { status, paid_date, amount, description, due_date, notes } = req.body;
    const sets = []; const params = [];
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (paid_date !== undefined) { sets.push('paid_date = ?'); params.push(paid_date); }
    if (amount !== undefined) { sets.push('amount = ?'); params.push(amount); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (due_date !== undefined) { sets.push('due_date = ?'); params.push(due_date); }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
    if (sets.length === 0) return res.json({ message: 'Nothing to update' });
    params.push(req.params.id);
    await prepareRun(`UPDATE employer_fees SET ${sets.join(', ')} WHERE id = ?`, ...params);
    res.json({ message: 'Fee updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update fee' });
  }
});

router.delete('/fees/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM employer_fees WHERE id = ?', req.params.id);
    res.json({ message: 'Fee deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete fee' });
  }
});

module.exports = router;
