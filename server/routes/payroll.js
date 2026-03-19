const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun, getDb } = require('../database');
const { calculatePayroll } = require('../services/payrollService');
const { ensureTrustAccount, recordTransaction } = require('../services/accountingService');

// GET /api/payroll — List all payroll runs
router.get('/payroll', async (req, res) => {
  try {
    const { employer_id, client_id, status } = req.query;
    let query = `SELECT pr.*, e.company_name, c.first_name, c.last_name, ec.job_title
                 FROM payroll_runs pr
                 LEFT JOIN employers e ON e.id = pr.employer_id
                 LEFT JOIN clients c ON c.id = pr.client_id
                 LEFT JOIN employer_clients ec ON ec.id = pr.employer_client_id`;
    const conditions = [];
    const params = [];

    if (employer_id) { conditions.push('pr.employer_id = ?'); params.push(employer_id); }
    if (client_id) { conditions.push('pr.client_id = ?'); params.push(client_id); }
    if (status) { conditions.push('pr.status = ?'); params.push(status); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY pr.created_at DESC';

    const runs = await prepareAll(query, ...params);

    // Aggregate stats
    const allRuns = await prepareAll('SELECT status, gross_pay, worker_payment_status, employer_payment_status, total_employer_cost, worker_paid_amount FROM payroll_runs');
    const stats = {
      total_runs: allRuns.length,
      total_gross: allRuns.reduce((s, r) => s + parseFloat(r.gross_pay || 0), 0),
      outstanding_worker: allRuns.filter(r => r.worker_payment_status !== 'paid').reduce((s, r) => s + (parseFloat(r.total_employer_cost || 0) - parseFloat(r.worker_paid_amount || 0)), 0),
      pending_employer: allRuns.filter(r => r.status === 'finalized' && r.employer_payment_status !== 'paid').length,
    };

    res.json({ runs, stats });
  } catch (err) {
    console.error('Error fetching payroll runs:', err);
    res.status(500).json({ error: 'Failed to fetch payroll runs' });
  }
});

// POST /api/payroll/run — Create/calculate a payroll run
router.post('/payroll/run', async (req, res) => {
  try {
    const { employer_id, client_id, employer_client_id, pay_period_start, pay_period_end, hours_worked, hourly_rate, province, pay_frequency, notes } = req.body;

    if (!employer_id || !client_id || !pay_period_start || !pay_period_end || !hours_worked || !hourly_rate) {
      return res.status(400).json({ error: 'employer_id, client_id, period dates, hours, and rate are required' });
    }

    // Calculate payroll
    const calc = calculatePayroll({
      hours: parseFloat(hours_worked),
      hourlyRate: parseFloat(hourly_rate),
      province: province || 'ON',
      payFrequency: pay_frequency || 'biweekly',
    });

    const result = await prepareRun(
      `INSERT INTO payroll_runs (employer_id, client_id, employer_client_id, pay_period_start, pay_period_end, pay_frequency,
         hours_worked, hourly_rate, gross_pay, federal_tax, provincial_tax, cpp_employee, ei_employee, total_deductions, net_pay,
         cpp_employer, ei_employer, total_employer_cost, province, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      employer_id, client_id, employer_client_id || null,
      pay_period_start, pay_period_end, pay_frequency || 'biweekly',
      hours_worked, hourly_rate,
      calc.gross_pay, calc.federal_tax, calc.provincial_tax,
      calc.cpp_employee, calc.ei_employee, calc.total_deductions, calc.net_pay,
      calc.cpp_employer, calc.ei_employer, calc.total_employer_cost,
      province || 'ON', notes || null, req.user?.id || null
    );

    const run = await prepareGet(
      `SELECT pr.*, e.company_name, c.first_name, c.last_name
       FROM payroll_runs pr
       LEFT JOIN employers e ON e.id = pr.employer_id
       LEFT JOIN clients c ON c.id = pr.client_id
       WHERE pr.id = ?`, result.lastInsertRowid
    );
    res.status(201).json(run);
  } catch (err) {
    console.error('Error creating payroll run:', err);
    res.status(500).json({ error: 'Failed to create payroll run' });
  }
});

// GET /api/payroll/:id — Get single payroll run
router.get('/payroll/:id', async (req, res) => {
  try {
    const run = await prepareGet(
      `SELECT pr.*, e.company_name, c.first_name, c.last_name, ec.job_title
       FROM payroll_runs pr
       LEFT JOIN employers e ON e.id = pr.employer_id
       LEFT JOIN clients c ON c.id = pr.client_id
       LEFT JOIN employer_clients ec ON ec.id = pr.employer_client_id
       WHERE pr.id = ?`, parseInt(req.params.id)
    );
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    res.json(run);
  } catch (err) {
    console.error('Error fetching payroll run:', err);
    res.status(500).json({ error: 'Failed to fetch payroll run' });
  }
});

// PUT /api/payroll/:id — Update a draft payroll run
router.put('/payroll/:id', async (req, res) => {
  try {
    const run = await prepareGet('SELECT * FROM payroll_runs WHERE id = ?', parseInt(req.params.id));
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'draft') return res.status(400).json({ error: 'Can only edit draft payroll runs' });

    const { hours_worked, hourly_rate, province, pay_frequency, pay_period_start, pay_period_end, notes } = req.body;
    const h = parseFloat(hours_worked || run.hours_worked);
    const r = parseFloat(hourly_rate || run.hourly_rate);
    const prov = province || run.province;
    const freq = pay_frequency || run.pay_frequency;

    const calc = calculatePayroll({ hours: h, hourlyRate: r, province: prov, payFrequency: freq });

    await prepareRun(
      `UPDATE payroll_runs SET hours_worked=?, hourly_rate=?, gross_pay=?, federal_tax=?, provincial_tax=?,
         cpp_employee=?, ei_employee=?, total_deductions=?, net_pay=?, cpp_employer=?, ei_employer=?,
         total_employer_cost=?, province=?, pay_frequency=?,
         pay_period_start=COALESCE(?, pay_period_start), pay_period_end=COALESCE(?, pay_period_end),
         notes=COALESCE(?, notes)
       WHERE id = ?`,
      h, r, calc.gross_pay, calc.federal_tax, calc.provincial_tax,
      calc.cpp_employee, calc.ei_employee, calc.total_deductions, calc.net_pay,
      calc.cpp_employer, calc.ei_employer, calc.total_employer_cost,
      prov, freq, pay_period_start || null, pay_period_end || null, notes, parseInt(req.params.id)
    );

    const updated = await prepareGet('SELECT * FROM payroll_runs WHERE id = ?', parseInt(req.params.id));
    res.json(updated);
  } catch (err) {
    console.error('Error updating payroll run:', err);
    res.status(500).json({ error: 'Failed to update payroll run' });
  }
});

// POST /api/payroll/:id/finalize — Finalize the payroll run
router.post('/payroll/:id/finalize', async (req, res) => {
  try {
    const run = await prepareGet('SELECT * FROM payroll_runs WHERE id = ?', parseInt(req.params.id));
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'draft') return res.status(400).json({ error: 'Only draft runs can be finalized' });

    await prepareRun("UPDATE payroll_runs SET status = 'finalized' WHERE id = ?", run.id);

    // Ensure trust account exists for worker
    await ensureTrustAccount(run.client_id);

    // Record a transaction showing payroll deposit is required
    const pool = getDb();
    const employer = await prepareGet('SELECT company_name FROM employers WHERE id = ?', run.employer_id);
    const empName = employer?.company_name || 'Employer';
    await recordTransaction(pool, run.client_id, 'deposit_to_trust', 0,
      `Payroll deposit required: $${parseFloat(run.total_employer_cost).toFixed(2)} for ${empName} (${run.pay_period_start} to ${run.pay_period_end})`,
      { reference_number: `PAYROLL-${run.id}`, created_by: 'Admin' }
    );

    res.json({ success: true, message: 'Payroll run finalized' });
  } catch (err) {
    console.error('Error finalizing payroll:', err);
    res.status(500).json({ error: 'Failed to finalize payroll run' });
  }
});

// POST /api/payroll/:id/record-worker-payment — Worker deposits payment
router.post('/payroll/:id/record-worker-payment', async (req, res) => {
  try {
    const run = await prepareGet('SELECT * FROM payroll_runs WHERE id = ?', parseInt(req.params.id));
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status === 'draft') return res.status(400).json({ error: 'Finalize the run first' });

    const { amount, reference_number } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    const pool = getDb();
    const employer = await prepareGet('SELECT company_name FROM employers WHERE id = ?', run.employer_id);

    // Record deposit to trust
    await recordTransaction(pool, run.client_id, 'deposit_to_trust', parseFloat(amount),
      `Payroll deposit from worker for ${employer?.company_name || 'employer'}`,
      { reference_number: reference_number || `PAYROLL-DEP-${run.id}`, created_by: 'Admin' }
    );

    // Update payroll run
    const newPaid = parseFloat(run.worker_paid_amount || 0) + parseFloat(amount);
    const status = newPaid >= parseFloat(run.total_employer_cost) ? 'paid' : 'partial';
    await prepareRun(
      "UPDATE payroll_runs SET worker_paid_amount = ?, worker_payment_status = ? WHERE id = ?",
      newPaid, status, run.id
    );

    res.json({ success: true, worker_paid_amount: newPaid, worker_payment_status: status });
  } catch (err) {
    console.error('Error recording worker payment:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// POST /api/payroll/:id/release-to-employer — Release funds to employer
router.post('/payroll/:id/release-to-employer', async (req, res) => {
  try {
    const run = await prepareGet('SELECT * FROM payroll_runs WHERE id = ?', parseInt(req.params.id));
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.worker_payment_status !== 'paid') return res.status(400).json({ error: 'Worker must pay in full before releasing to employer' });

    const { amount } = req.body;
    const releaseAmount = parseFloat(amount || run.total_employer_cost);

    const pool = getDb();
    const employer = await prepareGet('SELECT company_name FROM employers WHERE id = ?', run.employer_id);

    // Release from trust to operating/employer
    await recordTransaction(pool, run.client_id, 'trust_to_operating', releaseAmount,
      `Payroll release to ${employer?.company_name || 'employer'} (${run.pay_period_start} to ${run.pay_period_end})`,
      { reference_number: `PAYROLL-REL-${run.id}`, created_by: 'Admin' }
    );

    const newPaid = parseFloat(run.employer_paid_amount || 0) + releaseAmount;
    await prepareRun(
      "UPDATE payroll_runs SET employer_paid_amount = ?, employer_payment_status = 'paid', status = 'paid' WHERE id = ?",
      newPaid, run.id
    );

    res.json({ success: true, employer_paid_amount: newPaid });
  } catch (err) {
    console.error('Error releasing to employer:', err);
    res.status(500).json({ error: err.message || 'Failed to release to employer' });
  }
});

// GET /api/employers/:id/payroll — Payroll history for an employer
router.get('/employers/:id/payroll', async (req, res) => {
  try {
    const runs = await prepareAll(
      `SELECT pr.*, c.first_name, c.last_name, ec.job_title
       FROM payroll_runs pr
       LEFT JOIN clients c ON c.id = pr.client_id
       LEFT JOIN employer_clients ec ON ec.id = pr.employer_client_id
       WHERE pr.employer_id = ?
       ORDER BY pr.created_at DESC`,
      parseInt(req.params.id)
    );
    res.json(runs);
  } catch (err) {
    console.error('Error fetching employer payroll:', err);
    res.status(500).json({ error: 'Failed to fetch employer payroll' });
  }
});

// GET /api/clients/:clientId/payroll — Payroll history for a worker
router.get('/clients/:clientId/payroll', async (req, res) => {
  try {
    const runs = await prepareAll(
      `SELECT pr.*, e.company_name, ec.job_title
       FROM payroll_runs pr
       LEFT JOIN employers e ON e.id = pr.employer_id
       LEFT JOIN employer_clients ec ON ec.id = pr.employer_client_id
       WHERE pr.client_id = ?
       ORDER BY pr.created_at DESC`,
      parseInt(req.params.clientId)
    );
    res.json(runs);
  } catch (err) {
    console.error('Error fetching client payroll:', err);
    res.status(500).json({ error: 'Failed to fetch client payroll' });
  }
});

module.exports = router;
