const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { sendPIFEmail, sendPortalEmail } = require('../services/emailService');
const { logBulkChanges, logAudit } = require('../middleware/audit');
const { createWorkflowTask, completeWorkflowTask } = require('../services/autoTaskService');

// GET /api/clients - List all clients
router.get('/', async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = 'SELECT * FROM clients';
        const conditions = [];
        const params = [];

        if (search) {
            conditions.push('(first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ? OR passport_number ILIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY created_at DESC';

        const clients = await prepareAll(query, ...params);

        const enriched = await Promise.all(clients.map(async (c) => {
            const [docCount, formCount, checkTotal, checkDone, deadlineCount] = await Promise.all([
                prepareGet('SELECT COUNT(*) as count FROM documents WHERE client_id = ?', c.id),
                prepareGet('SELECT COUNT(*) as count FROM forms WHERE client_id = ?', c.id),
                prepareGet('SELECT COUNT(*) as count FROM client_checklist_status WHERE client_id = ?', c.id),
                prepareGet("SELECT COUNT(*) as count FROM client_checklist_status WHERE client_id = ? AND status = 'uploaded'", c.id),
                prepareGet("SELECT COUNT(*) as count FROM client_deadlines WHERE client_id = ? AND status = 'pending'", c.id),
            ]);
            return {
                ...c,
                doc_count: parseInt(docCount?.count || 0),
                form_count: parseInt(formCount?.count || 0),
                checklist_total: parseInt(checkTotal?.count || 0),
                checklist_completed: parseInt(checkDone?.count || 0),
                deadline_count: parseInt(deadlineCount?.count || 0),
            };
        }));

        res.json(enriched);
    } catch (err) {
        console.error('Error fetching clients:', err);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// POST /api/clients - Create a new client
router.post('/', async (req, res) => {
    try {
        const { first_name, last_name, email, phone, nationality, date_of_birth, passport_number, visa_type, notes } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }

        const formToken = uuidv4();

        const result = await prepareRun(
            `INSERT INTO clients (first_name, last_name, email, phone, nationality, date_of_birth, passport_number, visa_type, notes, form_token, pif_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            first_name, last_name, email || null, phone || null, nationality || null,
            date_of_birth || null, passport_number || null, visa_type || null, notes || null, formToken
        );

        const client = await prepareGet('SELECT * FROM clients WHERE id = ?', result.lastInsertRowid);

        // Auto-create workflow tasks
        const clientName = `${first_name} ${last_name}`;
        try {
            await createWorkflowTask(client.id, { title: `Send PIF form to ${clientName}`, category: 'PIF', priority: 'high', dueDays: 1 });
            await createWorkflowTask(client.id, { title: `Generate retainer agreement for ${clientName}`, category: 'Client Follow-up', priority: 'medium', dueDays: 3 });
        } catch (e) { console.error('Auto-task creation failed:', e.message); }

        res.status(201).json(client);
    } catch (err) {
        console.error('Error creating client:', err);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// POST /api/clients/:id/send-pif - Send PIF form email to client
router.post('/:id/send-pif', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const client = await prepareGet('SELECT * FROM clients WHERE id = ?', id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        if (!client.email) {
            return res.status(400).json({ error: 'Client has no email address' });
        }

        // Generate token if missing
        let token = client.form_token;
        if (!token) {
            token = uuidv4();
            await prepareRun('UPDATE clients SET form_token = ? WHERE id = ?', token, id);
        }

        const clientName = `${client.first_name} ${client.last_name}`;
        const result = await sendPIFEmail(client.email, clientName, token, client.visa_type || 'Immigration Service');

        // Update status to sent
        await prepareRun("UPDATE clients SET pif_status = 'sent', updated_at = NOW() WHERE id = ?", id);

        // Auto-tasks: mark "Send PIF" done, create follow-up
        try {
            await completeWorkflowTask(id, `Send PIF form to ${clientName}`);
            await createWorkflowTask(id, { title: `Follow up on PIF submission — ${clientName}`, category: 'PIF', priority: 'medium', dueDays: 7 });
        } catch (e) { console.error('Auto-task update failed:', e.message); }

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Error sending PIF email:', err);
        res.status(500).json({ error: 'Failed to send PIF email: ' + err.message });
    }
});

// POST /api/clients/:id/send-portal - Send client portal link
router.post('/:id/send-portal', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const client = await prepareGet('SELECT * FROM clients WHERE id = ?', id);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        if (!client.email) return res.status(400).json({ error: 'Client has no email address' });

        let token = client.form_token;
        if (!token) {
            token = uuidv4();
            await prepareRun('UPDATE clients SET form_token = ? WHERE id = ?', token, id);
        }

        const clientName = `${client.first_name} ${client.last_name}`;
        const result = await sendPortalEmail(client.email, clientName, token, client.visa_type || 'Immigration Service');

        // Timeline event
        await prepareRun(
            `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
             VALUES (?, 'portal_sent', 'Portal link sent', ?, 'Admin')`,
            id, `Portal link sent to ${client.email}`
        );

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Error sending portal email:', err);
        res.status(500).json({ error: 'Failed to send portal email: ' + err.message });
    }
});

// GET /api/clients/:id - Get single client
router.get('/:id', async (req, res) => {
    try {
        const client = await prepareGet('SELECT * FROM clients WHERE id = ?', parseInt(req.params.id));
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const [documents, forms, clientData, filledForms, retainers, retainerAgreements, employerLinks, familyMembers, deadlines, checklistProgress, verificationSummary] = await Promise.all([
            prepareAll('SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at DESC', client.id),
            prepareAll('SELECT * FROM forms WHERE client_id = ? ORDER BY uploaded_at DESC', client.id),
            prepareAll('SELECT * FROM client_data WHERE client_id = ? ORDER BY field_key', client.id),
            prepareAll('SELECT * FROM filled_forms WHERE client_id = ? ORDER BY filled_at DESC', client.id),
            prepareAll('SELECT * FROM retainers WHERE client_id = ? ORDER BY created_at DESC', client.id),
            prepareAll('SELECT id, status, generated_at, signed_at, signing_provider, sent_for_signing_at FROM client_retainer_agreements WHERE client_id = ? ORDER BY generated_at DESC', client.id),
            prepareAll(`SELECT ec.*, e.company_name, e.contact_name, e.contact_email, e.industry
                        FROM employer_clients ec JOIN employers e ON e.id = ec.employer_id
                        WHERE ec.client_id = ? ORDER BY ec.created_at DESC`, client.id),
            prepareAll('SELECT * FROM dependents WHERE client_id = ? ORDER BY created_at DESC', client.id),
            prepareAll("SELECT * FROM client_deadlines WHERE client_id = ? AND status = 'pending' ORDER BY deadline_date ASC", client.id),
            prepareGet(`SELECT COUNT(*) as total,
                        COUNT(CASE WHEN status = 'uploaded' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'missing' THEN 1 END) as missing
                        FROM client_checklist_status WHERE client_id = ?`, client.id),
            prepareGet(`SELECT COUNT(*) as total,
                        COUNT(CASE WHEN verified = true THEN 1 END) as verified,
                        COUNT(CASE WHEN verified = false AND comment IS NOT NULL AND comment != '' THEN 1 END) as flagged
                        FROM pif_field_verifications WHERE client_id = ?`, client.id),
        ]);

        res.json({
            ...client, documents, forms, client_data: clientData, filled_forms: filledForms,
            retainers, retainer_agreements: retainerAgreements,
            employer_links: employerLinks, family_members: familyMembers, deadlines,
            checklist_progress: {
                total: parseInt(checklistProgress?.total || 0),
                completed: parseInt(checklistProgress?.completed || 0),
                missing: parseInt(checklistProgress?.missing || 0),
            },
            verification_summary: {
                total: parseInt(verificationSummary?.total || 0),
                verified: parseInt(verificationSummary?.verified || 0),
                flagged: parseInt(verificationSummary?.flagged || 0),
            },
        });
    } catch (err) {
        console.error('Error fetching client:', err);
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// PUT /api/clients/:id - Update client
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prepareGet('SELECT * FROM clients WHERE id = ?', id);
        if (!existing) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const { first_name, last_name, email, phone, nationality, date_of_birth, passport_number, visa_type, status, notes } = req.body;
        await prepareRun(
            `UPDATE clients SET
        first_name = ?, last_name = ?, email = ?, phone = ?,
        nationality = ?, date_of_birth = ?, passport_number = ?,
        visa_type = ?, status = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
            first_name || existing.first_name,
            last_name || existing.last_name,
            email !== undefined ? email : existing.email,
            phone !== undefined ? phone : existing.phone,
            nationality !== undefined ? nationality : existing.nationality,
            date_of_birth !== undefined ? date_of_birth : existing.date_of_birth,
            passport_number !== undefined ? passport_number : existing.passport_number,
            visa_type !== undefined ? visa_type : existing.visa_type,
            status || existing.status,
            notes !== undefined ? notes : existing.notes,
            id
        );

        const updated = await prepareGet('SELECT * FROM clients WHERE id = ?', id);

        // Audit log: track changed fields
        const trackFields = ['first_name', 'last_name', 'email', 'phone', 'nationality', 'date_of_birth', 'passport_number', 'visa_type', 'status', 'notes'];
        const changes = trackFields
            .filter(f => String(existing[f] || '') !== String(updated[f] || ''))
            .map(f => ({ fieldKey: f, oldValue: existing[f], newValue: updated[f] }));
        if (changes.length > 0) {
            await logBulkChanges(req, { clientId: id, entityType: 'client', entityId: id, action: 'update', changes });
        }

        res.json(updated);
    } catch (err) {
        console.error('Error updating client:', err);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// PATCH /api/clients/:id/stage - Update pipeline stage
router.patch('/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    const validStages = ['lead', 'consultation', 'retainer_signed', 'in_progress', 'submitted', 'approved'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    const clientId = parseInt(req.params.id);
    const old = await prepareGet('SELECT pipeline_stage FROM clients WHERE id = ?', clientId);
    await prepareRun('UPDATE clients SET pipeline_stage = ? WHERE id = ?', stage, clientId);
    await logAudit(req, { clientId, entityType: 'client', entityId: clientId, action: 'update', fieldKey: 'pipeline_stage', oldValue: old?.pipeline_stage, newValue: stage });
    res.json({ message: 'Stage updated' });
  } catch (err) {
    console.error('Error updating pipeline stage:', err);
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

// DELETE /api/clients/:id - Delete client
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prepareGet('SELECT * FROM clients WHERE id = ?', id);
        if (!existing) {
            return res.status(404).json({ error: 'Client not found' });
        }
        await prepareRun('DELETE FROM clients WHERE id = ?', id);
        res.json({ message: 'Client deleted successfully' });
    } catch (err) {
        console.error('Error deleting client:', err);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

module.exports = router;
