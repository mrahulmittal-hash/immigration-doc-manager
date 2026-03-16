const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

const LMIA_STAGES = ['draft','job_ad_posted','recruiting','application_prep','submitted_esdc','additional_info','approved','refused','withdrawn'];

// GET /api/lmia — list all LMIA applications
router.get('/', async (req, res) => {
  try {
    const { status, employer_id, stream } = req.query;
    let sql = `SELECT la.*, e.company_name AS employer_name, c.first_name, c.last_name,
      (SELECT COUNT(*) FROM job_bank_ads ja WHERE ja.lmia_id = la.id) AS ad_count
      FROM lmia_applications la
      JOIN employers e ON e.id = la.employer_id
      LEFT JOIN clients c ON c.id = la.client_id
      WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ' AND la.status = ?'; }
    if (employer_id) { params.push(employer_id); sql += ' AND la.employer_id = ?'; }
    if (stream) { params.push(stream); sql += ' AND la.stream = ?'; }
    sql += ' ORDER BY la.created_at DESC';
    const rows = await prepareAll(sql, ...params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching LMIAs:', err);
    res.status(500).json({ error: 'Failed to fetch LMIA applications' });
  }
});

// POST /api/lmia — create LMIA
router.post('/', async (req, res) => {
  try {
    const { employer_id, client_id, job_title, noc_code, teer_category, wage_offered, wage_type, work_location, num_positions, stream, job_duties, transition_plan, notes } = req.body;
    const result = await prepareRun(
      `INSERT INTO lmia_applications (employer_id, client_id, job_title, noc_code, teer_category, wage_offered, wage_type, work_location, num_positions, stream, job_duties, transition_plan, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      employer_id, client_id || null, job_title, noc_code || null, teer_category || null,
      wage_offered || null, wage_type || 'hourly', work_location || null, num_positions || 1,
      stream || 'high_wage', job_duties || null, transition_plan || null, notes || null
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'LMIA application created' });
  } catch (err) {
    console.error('Error creating LMIA:', err);
    res.status(500).json({ error: 'Failed to create LMIA application' });
  }
});

// GET /api/lmia/:id — detail
router.get('/:id', async (req, res) => {
  try {
    const lmia = await prepareGet(
      `SELECT la.*, e.company_name AS employer_name, e.contact_name AS employer_contact,
        c.first_name, c.last_name, c.email AS client_email
       FROM lmia_applications la
       JOIN employers e ON e.id = la.employer_id
       LEFT JOIN clients c ON c.id = la.client_id
       WHERE la.id = ?`, req.params.id
    );
    if (!lmia) return res.status(404).json({ error: 'LMIA not found' });

    const ads = await prepareAll(
      'SELECT * FROM job_bank_ads WHERE lmia_id = ? ORDER BY posting_date DESC',
      req.params.id
    );
    res.json({ ...lmia, ads });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LMIA' });
  }
});

// PUT /api/lmia/:id — update
router.put('/:id', async (req, res) => {
  try {
    const fields = ['employer_id','client_id','job_title','noc_code','teer_category','wage_offered','wage_type','work_location','num_positions','lmia_number','stream','status','submission_date','decision_date','expiry_date','job_duties','transition_plan','notes'];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (sets.length === 0) return res.json({ message: 'Nothing to update' });
    sets.push('updated_at = NOW()');
    params.push(req.params.id);
    await prepareRun(`UPDATE lmia_applications SET ${sets.join(', ')} WHERE id = ?`, ...params);
    res.json({ message: 'LMIA updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update LMIA' });
  }
});

// PATCH /api/lmia/:id/status — change status with workflow logic
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!LMIA_STAGES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${LMIA_STAGES.join(', ')}` });
    }

    const lmia = await prepareGet('SELECT * FROM lmia_applications WHERE id = ?', req.params.id);
    if (!lmia) return res.status(404).json({ error: 'LMIA not found' });

    const updates = ['status = ?', 'updated_at = NOW()'];
    const params = [status];

    // Auto-set dates based on status
    if (status === 'submitted_esdc' && !lmia.submission_date) {
      updates.push('submission_date = CURRENT_DATE');
    }
    if ((status === 'approved' || status === 'refused') && !lmia.decision_date) {
      updates.push('decision_date = CURRENT_DATE');
    }

    params.push(req.params.id);
    await prepareRun(`UPDATE lmia_applications SET ${updates.join(', ')} WHERE id = ?`, ...params);

    // Auto-create timeline event if client linked
    if (lmia.client_id) {
      const stageLabels = {
        draft: 'LMIA Draft Created',
        job_ad_posted: 'Job Bank Ad Posted',
        recruiting: 'Recruitment Phase Started',
        application_prep: 'LMIA Application Being Prepared',
        submitted_esdc: 'LMIA Submitted to ESDC',
        additional_info: 'ESDC Requested Additional Info',
        approved: 'LMIA Approved',
        refused: 'LMIA Refused',
        withdrawn: 'LMIA Application Withdrawn',
      };
      await prepareRun(
        `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
         VALUES (?, 'lmia_update', ?, ?, 'System')`,
        lmia.client_id, stageLabels[status] || `LMIA status: ${status}`,
        `LMIA for "${lmia.job_title}" moved to ${status}`
      );

      // Auto-create 4-week deadline when job ad posted
      if (status === 'job_ad_posted') {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 28);
        await prepareRun(
          `INSERT INTO client_deadlines (client_id, title, deadline_date, category, notes)
           VALUES (?, 'Job Bank ad minimum posting period ends', ?, 'lmia', ?)`,
          lmia.client_id, deadline.toISOString().split('T')[0],
          `LMIA for "${lmia.job_title}" — minimum 4-week Job Bank posting requirement`
        );
      }
    }

    res.json({ message: `LMIA status updated to ${status}` });
  } catch (err) {
    console.error('Error updating LMIA status:', err);
    res.status(500).json({ error: 'Failed to update LMIA status' });
  }
});

// DELETE /api/lmia/:id
router.delete('/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM lmia_applications WHERE id = ?', req.params.id);
    res.json({ message: 'LMIA deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete LMIA' });
  }
});

// ── Job Bank Ads ─────────────────────────────────────────────

router.get('/:id/ads', async (req, res) => {
  try {
    const rows = await prepareAll(
      'SELECT * FROM job_bank_ads WHERE lmia_id = ? ORDER BY posting_date DESC',
      req.params.id
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job ads' });
  }
});

router.post('/:id/ads', async (req, res) => {
  try {
    const lmia = await prepareGet('SELECT * FROM lmia_applications WHERE id = ?', req.params.id);
    if (!lmia) return res.status(404).json({ error: 'LMIA not found' });

    const { job_bank_id, job_title, noc_code, posting_date, expiry_date, posting_url, additional_ads, notes } = req.body;
    const result = await prepareRun(
      `INSERT INTO job_bank_ads (lmia_id, employer_id, job_bank_id, job_title, noc_code, posting_date, expiry_date, posting_url, additional_ads, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.params.id, lmia.employer_id, job_bank_id || null,
      job_title || lmia.job_title, noc_code || lmia.noc_code,
      posting_date, expiry_date || null, posting_url || null,
      JSON.stringify(additional_ads || []), notes || null
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Job ad created' });
  } catch (err) {
    console.error('Error creating job ad:', err);
    res.status(500).json({ error: 'Failed to create job ad' });
  }
});

router.put('/ads/:id', async (req, res) => {
  try {
    const fields = ['job_bank_id','job_title','noc_code','posting_date','expiry_date','posting_url','status','additional_ads','notes'];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        params.push(f === 'additional_ads' ? JSON.stringify(req.body[f]) : req.body[f]);
      }
    }
    if (sets.length === 0) return res.json({ message: 'Nothing to update' });
    params.push(req.params.id);
    await prepareRun(`UPDATE job_bank_ads SET ${sets.join(', ')} WHERE id = ?`, ...params);
    res.json({ message: 'Job ad updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update job ad' });
  }
});

router.delete('/ads/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM job_bank_ads WHERE id = ?', req.params.id);
    res.json({ message: 'Job ad deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete job ad' });
  }
});

// GET /api/lmia/stats — aggregate LMIA stats
router.get('/stats/summary', async (req, res) => {
  try {
    const rows = await prepareAll(`SELECT status, COUNT(*) AS count FROM lmia_applications GROUP BY status`);
    const byStatus = {};
    rows.forEach(r => byStatus[r.status] = parseInt(r.count));
    const total = rows.reduce((s, r) => s + parseInt(r.count), 0);
    const active = total - (byStatus.approved || 0) - (byStatus.refused || 0) - (byStatus.withdrawn || 0);
    res.json({ total, active, byStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LMIA stats' });
  }
});

module.exports = router;
