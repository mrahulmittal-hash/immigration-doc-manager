const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun, getDb } = require('../database');
const { ensureTrustAccount, recordTransaction, generateInvoiceNumber, generateInvoicePDF, generateReceiptPDF, getClientFinancialSummary } = require('../services/accountingService');

// ═══════════════════════════════════════════════════════════════
// RETAINERS CRUD
// ═══════════════════════════════════════════════════════════════

// GET /api/clients/:clientId/retainers
router.get('/clients/:clientId/retainers', async (req, res) => {
  try {
    const retainers = await prepareAll(
      'SELECT * FROM retainers WHERE client_id = ? ORDER BY created_at DESC',
      req.params.clientId
    );
    res.json(retainers);
  } catch (err) {
    console.error('Error fetching retainers:', err);
    res.status(500).json({ error: 'Failed to fetch retainers' });
  }
});

// POST /api/clients/:clientId/retainers
router.post('/clients/:clientId/retainers', async (req, res) => {
  try {
    const { service_type, retainer_fee, due_date } = req.body;
    if (!service_type) return res.status(400).json({ error: 'Service type is required' });

    const result = await prepareRun(
      `INSERT INTO retainers (client_id, service_type, retainer_fee, amount_paid, status, due_date)
       VALUES (?, ?, ?, 0, 'pending', ?)`,
      req.params.clientId, service_type, parseFloat(retainer_fee || 0), due_date || null
    );

    const retainer = await prepareGet('SELECT * FROM retainers WHERE id = ?', result.lastInsertRowid);

    // Timeline event
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'retainer_created', 'Retainer created', ?, 'Admin')`,
      req.params.clientId, `${service_type} — $${parseFloat(retainer_fee || 0).toFixed(2)}`
    );

    res.status(201).json(retainer);
  } catch (err) {
    console.error('Error creating retainer:', err);
    res.status(500).json({ error: 'Failed to create retainer' });
  }
});

// PUT /api/retainers/:id
router.put('/retainers/:id', async (req, res) => {
  try {
    const { service_type, retainer_fee, status, signed_date, due_date } = req.body;
    const existing = await prepareGet('SELECT * FROM retainers WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Retainer not found' });

    await prepareRun(
      `UPDATE retainers SET service_type = ?, retainer_fee = ?, status = ?, signed_date = ?, due_date = ? WHERE id = ?`,
      service_type || existing.service_type,
      retainer_fee !== undefined ? parseFloat(retainer_fee) : existing.retainer_fee,
      status || existing.status,
      signed_date || existing.signed_date,
      due_date || existing.due_date,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating retainer:', err);
    res.status(500).json({ error: 'Failed to update retainer' });
  }
});

// DELETE /api/retainers/:id
router.delete('/retainers/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM retainers WHERE id = ?', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting retainer:', err);
    res.status(500).json({ error: 'Failed to delete retainer' });
  }
});

// GET /api/retainers/:id/payments
router.get('/retainers/:id/payments', async (req, res) => {
  try {
    const retainer = await prepareGet('SELECT * FROM retainers WHERE id = ?', req.params.id);
    if (!retainer) return res.status(404).json({ error: 'Retainer not found' });

    const payments = await prepareAll(
      `SELECT * FROM transactions WHERE client_id = ? AND description LIKE '%retainer%' ORDER BY created_at DESC`,
      retainer.client_id
    );
    res.json(payments);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/retainers/:id/payments
router.post('/retainers/:id/payments', async (req, res) => {
  try {
    const { amount, description, reference_number } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const retainer = await prepareGet('SELECT * FROM retainers WHERE id = ?', req.params.id);
    if (!retainer) return res.status(404).json({ error: 'Retainer not found' });

    // Update amount_paid on retainer
    const newPaid = parseFloat(retainer.amount_paid || 0) + parseFloat(amount);
    const newStatus = newPaid >= parseFloat(retainer.retainer_fee) ? 'active' : 'pending';
    await prepareRun(
      'UPDATE retainers SET amount_paid = ?, status = ? WHERE id = ?',
      newPaid, newStatus, req.params.id
    );

    // Record as trust deposit
    await ensureTrustAccount(retainer.client_id);
    const pool = getDb();
    const txId = await recordTransaction(pool, retainer.client_id, 'deposit_to_trust', parseFloat(amount),
      description || `Retainer payment — ${retainer.service_type}`, { reference_number }
    );

    // Timeline
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'retainer_payment', 'Retainer payment received', ?, 'Admin')`,
      retainer.client_id, `$${parseFloat(amount).toFixed(2)} for ${retainer.service_type}`
    );

    res.json({ success: true, transaction_id: txId, amount_paid: newPaid, status: newStatus });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ACCOUNTING SUMMARY & TRUST
// ═══════════════════════════════════════════════════════════════

// GET /api/accounting/summary — Aggregate financial summary
router.get('/accounting/summary', async (req, res) => {
  try {
    const totalTrust = await prepareGet('SELECT COALESCE(SUM(balance), 0) as total FROM trust_accounts');
    const operating = await prepareGet('SELECT balance FROM operating_accounts WHERE id = 1');
    const pendingReleases = await prepareGet(
      "SELECT COALESCE(SUM(amount), 0) as total FROM milestone_releases WHERE status = 'pending'"
    );
    const outstandingInvoices = await prepareGet(
      "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status IN ('sent', 'overdue')"
    );

    const recentTx = await prepareAll(
      `SELECT t.*, c.first_name, c.last_name
       FROM transactions t
       LEFT JOIN clients c ON c.id = t.client_id
       ORDER BY t.created_at DESC LIMIT 20`
    );

    const clientBalances = await prepareAll(
      `SELECT ta.client_id, ta.balance, c.first_name, c.last_name, c.visa_type
       FROM trust_accounts ta
       JOIN clients c ON c.id = ta.client_id
       WHERE ta.balance > 0
       ORDER BY ta.balance DESC`
    );

    res.json({
      total_trust: parseFloat(totalTrust?.total || 0),
      operating_balance: parseFloat(operating?.balance || 0),
      pending_releases: parseFloat(pendingReleases?.total || 0),
      outstanding_invoices: parseFloat(outstandingInvoices?.total || 0),
      recent_transactions: recentTx,
      client_balances: clientBalances,
    });
  } catch (err) {
    console.error('Error fetching accounting summary:', err);
    res.status(500).json({ error: 'Failed to fetch accounting summary' });
  }
});

// GET /api/clients/:clientId/trust — Client trust details
router.get('/clients/:clientId/trust', async (req, res) => {
  try {
    await ensureTrustAccount(req.params.clientId);
    const summary = await getClientFinancialSummary(req.params.clientId);
    const transactions = await prepareAll(
      'SELECT * FROM transactions WHERE client_id = ? ORDER BY created_at DESC',
      req.params.clientId
    );
    const milestones = await prepareAll(
      'SELECT * FROM milestone_releases WHERE client_id = ? ORDER BY created_at',
      req.params.clientId
    );
    res.json({ ...summary, transactions, milestones });
  } catch (err) {
    console.error('Error fetching client trust:', err);
    res.status(500).json({ error: 'Failed to fetch trust details' });
  }
});

// POST /api/clients/:clientId/trust/deposit — Deposit to trust
router.post('/clients/:clientId/trust/deposit', async (req, res) => {
  try {
    const { amount, description, reference_number } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    await ensureTrustAccount(req.params.clientId);

    const pool = getDb();
    const txId = await recordTransaction(pool, parseInt(req.params.clientId), 'deposit_to_trust', parseFloat(amount), description || 'Trust deposit', {
      reference_number,
    });

    // Timeline event
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'trust_deposit', 'Trust deposit received', ?, 'Admin')`,
      req.params.clientId, `$${parseFloat(amount).toFixed(2)} deposited${reference_number ? ` (Ref: ${reference_number})` : ''}`
    );

    res.json({ success: true, transaction_id: txId });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ error: err.message || 'Failed to record deposit' });
  }
});

// POST /api/clients/:clientId/trust/release — Release funds from trust to operating
router.post('/clients/:clientId/trust/release', async (req, res) => {
  try {
    const { amount, description, pipeline_stage } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const pool = getDb();
    const txId = await recordTransaction(pool, parseInt(req.params.clientId), 'trust_to_operating', parseFloat(amount), description || 'Milestone release', {
      pipeline_stage,
    });

    // Timeline
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'trust_release', 'Funds released from trust', ?, 'Admin')`,
      req.params.clientId, `$${parseFloat(amount).toFixed(2)} released to operating${pipeline_stage ? ` (${pipeline_stage})` : ''}`
    );

    res.json({ success: true, transaction_id: txId });
  } catch (err) {
    console.error('Release error:', err);
    res.status(500).json({ error: err.message || 'Failed to release funds' });
  }
});

// POST /api/clients/:clientId/trust/refund — Refund from trust
router.post('/clients/:clientId/trust/refund', async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const pool = getDb();
    const txId = await recordTransaction(pool, parseInt(req.params.clientId), 'refund', parseFloat(amount), description || 'Client refund');

    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'trust_refund', 'Refund from trust', ?, 'Admin')`,
      req.params.clientId, `$${parseFloat(amount).toFixed(2)} refunded to client`
    );

    res.json({ success: true, transaction_id: txId });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({ error: err.message || 'Failed to process refund' });
  }
});

// GET /api/clients/:clientId/invoices — List invoices
router.get('/clients/:clientId/invoices', async (req, res) => {
  try {
    const invoices = await prepareAll(
      'SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC',
      req.params.clientId
    );
    res.json(invoices);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// POST /api/clients/:clientId/invoices — Create invoice
router.post('/clients/:clientId/invoices', async (req, res) => {
  try {
    const { description, amount, due_date } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const invoiceNumber = await generateInvoiceNumber();

    const result = await prepareRun(
      `INSERT INTO invoices (client_id, invoice_number, description, amount, status, due_date)
       VALUES (?, ?, ?, ?, 'draft', ?)`,
      req.params.clientId, invoiceNumber, description || '', parseFloat(amount), due_date || null
    );

    res.json({ success: true, id: result.lastID || result.id, invoice_number: invoiceNumber });
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /api/invoices/:id — Update invoice
router.put('/invoices/:id', async (req, res) => {
  try {
    const { status, amount, description, due_date } = req.body;
    const invoice = await prepareGet('SELECT * FROM invoices WHERE id = ?', req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const updates = [];
    const vals = [];
    if (status !== undefined) { updates.push('status'); vals.push(status); }
    if (amount !== undefined) { updates.push('amount'); vals.push(parseFloat(amount)); }
    if (description !== undefined) { updates.push('description'); vals.push(description); }
    if (due_date !== undefined) { updates.push('due_date'); vals.push(due_date); }

    if (status === 'paid' && !invoice.paid_date) {
      updates.push('paid_date');
      vals.push(new Date().toISOString().slice(0, 10));
    }

    if (updates.length === 0) return res.json({ success: true });

    const setClauses = updates.map((u, i) => `${u} = $${i + 1}`).join(', ');
    vals.push(req.params.id);

    await prepareRun(`UPDATE invoices SET ${setClauses} WHERE id = $${vals.length}`, ...vals);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// GET /api/clients/:clientId/milestones — List milestones
router.get('/clients/:clientId/milestones', async (req, res) => {
  try {
    const milestones = await prepareAll(
      'SELECT * FROM milestone_releases WHERE client_id = ? ORDER BY created_at',
      req.params.clientId
    );
    res.json(milestones);
  } catch (err) {
    console.error('Error fetching milestones:', err);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// POST /api/clients/:clientId/milestones — Create milestone definitions
router.post('/clients/:clientId/milestones', async (req, res) => {
  try {
    const { milestones } = req.body;
    if (!milestones || !Array.isArray(milestones)) {
      return res.status(400).json({ error: 'milestones array required' });
    }

    for (const m of milestones) {
      await prepareRun(
        `INSERT INTO milestone_releases (client_id, pipeline_stage, amount, percentage, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        req.params.clientId, m.pipeline_stage, parseFloat(m.amount || 0), parseFloat(m.percentage || 0)
      );
    }

    res.json({ success: true, count: milestones.length });
  } catch (err) {
    console.error('Error creating milestones:', err);
    res.status(500).json({ error: 'Failed to create milestones' });
  }
});

// POST /api/milestones/:id/release — Trigger milestone release
router.post('/milestones/:id/release', async (req, res) => {
  try {
    const milestone = await prepareGet('SELECT * FROM milestone_releases WHERE id = ?', req.params.id);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    if (milestone.status === 'released') return res.status(400).json({ error: 'Milestone already released' });

    const pool = getDb();
    const txId = await recordTransaction(
      pool,
      milestone.client_id,
      'trust_to_operating',
      parseFloat(milestone.amount),
      `Milestone release: ${milestone.pipeline_stage}`,
      { pipeline_stage: milestone.pipeline_stage }
    );

    await prepareRun(
      "UPDATE milestone_releases SET status = 'released', released_at = NOW(), transaction_id = ? WHERE id = ?",
      txId, milestone.id
    );

    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'milestone_released', 'Milestone funds released', ?, 'Admin')`,
      milestone.client_id,
      `$${parseFloat(milestone.amount).toFixed(2)} released for ${milestone.pipeline_stage}`
    );

    res.json({ success: true, transaction_id: txId });
  } catch (err) {
    console.error('Milestone release error:', err);
    res.status(500).json({ error: err.message || 'Failed to release milestone' });
  }
});

// GET /api/accounting/transactions — All transactions with filters
router.get('/accounting/transactions', async (req, res) => {
  try {
    const { type, client_id, from, to } = req.query;
    let sql = `SELECT t.*, c.first_name, c.last_name FROM transactions t LEFT JOIN clients c ON c.id = t.client_id WHERE 1=1`;
    const params = [];

    if (type) { params.push(type); sql += ` AND t.type = $${params.length}`; }
    if (client_id) { params.push(client_id); sql += ` AND t.client_id = $${params.length}`; }
    if (from) { params.push(from); sql += ` AND t.created_at >= $${params.length}`; }
    if (to) { params.push(to); sql += ` AND t.created_at <= $${params.length}`; }

    sql += ' ORDER BY t.created_at DESC LIMIT 200';

    // Use raw query since we built params as $1,$2...
    const { getDb } = require('../database');
    const pool = getDb();
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/accounting/audit-log — CICC-compliant audit export
router.get('/accounting/audit-log', async (req, res) => {
  try {
    const transactions = await prepareAll(
      `SELECT t.*, c.first_name, c.last_name, c.email, c.visa_type,
              ta.balance as current_trust_balance
       FROM transactions t
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN trust_accounts ta ON ta.client_id = t.client_id
       ORDER BY t.created_at ASC`
    );
    res.json({
      generated_at: new Date().toISOString(),
      total_transactions: transactions.length,
      transactions,
    });
  } catch (err) {
    console.error('Error generating audit log:', err);
    res.status(500).json({ error: 'Failed to generate audit log' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CLIENT PAYMENTS & BALANCE (new accounting)
// ═══════════════════════════════════════════════════════════════

// GET /api/clients/:clientId/payments — all payments for client
router.get('/clients/:clientId/payments', async (req, res) => {
  try {
    const payments = await prepareAll(
      'SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date DESC, created_at DESC',
      req.params.clientId
    );
    res.json(payments);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/clients/:clientId/payments — record a payment
router.post('/clients/:clientId/payments', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { amount, payment_method, payment_date, reference_number, retainer_id, invoice_id, notes } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    const result = await prepareRun(
      `INSERT INTO payments (client_id, retainer_id, amount, payment_method, payment_date, reference_number, invoice_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      clientId, retainer_id || null, parseFloat(amount),
      payment_method || null, payment_date || new Date().toISOString().split('T')[0],
      reference_number || null, invoice_id || null, notes || null
    );

    // Update retainer amount_paid if linked
    if (retainer_id) {
      await prepareRun(
        `UPDATE retainers SET amount_paid = amount_paid + ?, updated_at = NOW(),
         status = CASE WHEN amount_paid + ? >= retainer_fee THEN 'paid'
                       WHEN amount_paid + ? > 0 THEN 'partial'
                       ELSE status END
         WHERE id = ?`,
        parseFloat(amount), parseFloat(amount), parseFloat(amount), retainer_id
      );
    }

    const payment = await prepareGet('SELECT * FROM payments WHERE id = ?', result.lastInsertRowid);
    res.status(201).json(payment);
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// GET /api/clients/:clientId/balance — outstanding balance
router.get('/clients/:clientId/balance', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const invoiceTotal = await prepareGet(
      'SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE client_id = ?', clientId
    );
    const paymentTotal = await prepareGet(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE client_id = ?', clientId
    );
    const totalInvoiced = parseFloat(invoiceTotal?.total || 0);
    const totalPaid = parseFloat(paymentTotal?.total || 0);
    res.json({
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      balance_due: totalInvoiced - totalPaid,
    });
  } catch (err) {
    console.error('Error fetching balance:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ═══════════════════════════════════════════════════════════════
// INVOICE & RECEIPT PDF GENERATION
// ═══════════════════════════════════════════════════════════════

// GET /api/invoices/:id/pdf — generate/download invoice PDF
router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const pdfBuffer = await generateInvoicePDF(parseInt(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating invoice PDF:', err);
    res.status(500).json({ error: err.message || 'Failed to generate invoice PDF' });
  }
});

// GET /api/payments/:id/receipt-pdf — generate/download receipt PDF
router.get('/payments/:id/receipt-pdf', async (req, res) => {
  try {
    const pdfBuffer = await generateReceiptPDF(parseInt(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating receipt PDF:', err);
    res.status(500).json({ error: err.message || 'Failed to generate receipt PDF' });
  }
});

// POST /api/invoices/:id/email — email invoice PDF to client
router.post('/invoices/:id/email', async (req, res) => {
  try {
    const invoice = await prepareGet(
      'SELECT i.*, c.first_name, c.last_name, c.email FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id = ?',
      parseInt(req.params.id)
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.email) return res.status(400).json({ error: 'Client has no email address' });

    const pdfBuffer = await generateInvoicePDF(parseInt(req.params.id));
    const { sendInvoiceEmail } = require('../services/emailService');
    const clientName = `${invoice.first_name} ${invoice.last_name}`;
    await sendInvoiceEmail(invoice.email, clientName, invoice.invoice_number, pdfBuffer);

    // Update status to sent if draft
    if (invoice.status === 'draft') {
      await prepareRun("UPDATE invoices SET status = 'sent' WHERE id = ?", invoice.id);
    }

    res.json({ success: true, message: `Invoice emailed to ${invoice.email}` });
  } catch (err) {
    console.error('Error emailing invoice:', err);
    res.status(500).json({ error: err.message || 'Failed to email invoice' });
  }
});

module.exports = router;
