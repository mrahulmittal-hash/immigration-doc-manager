const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { sendPIFEmail } = require('../services/emailService');

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
            const docCount = await prepareGet('SELECT COUNT(*) as count FROM documents WHERE client_id = ?', c.id);
            const formCount = await prepareGet('SELECT COUNT(*) as count FROM forms WHERE client_id = ?', c.id);
            return { ...c, doc_count: parseInt(docCount?.count || 0), form_count: parseInt(formCount?.count || 0) };
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

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Error sending PIF email:', err);
        res.status(500).json({ error: 'Failed to send PIF email: ' + err.message });
    }
});

// GET /api/clients/:id - Get single client
router.get('/:id', async (req, res) => {
    try {
        const client = await prepareGet('SELECT * FROM clients WHERE id = ?', parseInt(req.params.id));
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const [documents, forms, clientData, filledForms] = await Promise.all([
            prepareAll('SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at DESC', client.id),
            prepareAll('SELECT * FROM forms WHERE client_id = ? ORDER BY uploaded_at DESC', client.id),
            prepareAll('SELECT * FROM client_data WHERE client_id = ? ORDER BY field_key', client.id),
            prepareAll('SELECT * FROM filled_forms WHERE client_id = ? ORDER BY filled_at DESC', client.id),
        ]);

        res.json({ ...client, documents, forms, client_data: clientData, filled_forms: filledForms });
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
    await prepareRun('UPDATE clients SET pipeline_stage = ? WHERE id = ?', stage, parseInt(req.params.id));
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
