const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/clients/:clientId/data
router.get('/clients/:clientId/data', async (req, res) => {
    try {
        const data = await prepareAll('SELECT * FROM client_data WHERE client_id = ? ORDER BY field_key', parseInt(req.params.clientId));
        res.json(data);
    } catch (err) {
        console.error('Error fetching client data:', err);
        res.status(500).json({ error: 'Failed to fetch client data' });
    }
});

// PUT /api/clients/:clientId/data
router.put('/clients/:clientId/data', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const { data } = req.body;

        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'Data must be an array of { field_key, field_value }' });
        }

        await prepareRun('DELETE FROM client_data WHERE client_id = ?', clientId);
        for (const item of data) {
            if (item.field_key && item.field_key.trim()) {
                await prepareRun('INSERT INTO client_data (client_id, field_key, field_value, source) VALUES (?, ?, ?, ?)',
                    clientId, item.field_key.trim(), item.field_value || '', item.source || 'manual');
            }
        }

        const updated = await prepareAll('SELECT * FROM client_data WHERE client_id = ? ORDER BY field_key', clientId);
        res.json(updated);
    } catch (err) {
        console.error('Error updating client data:', err);
        res.status(500).json({ error: 'Failed to update client data' });
    }
});

// POST /api/clients/:clientId/data/add
router.post('/clients/:clientId/data/add', async (req, res) => {
    try {
        const { field_key, field_value } = req.body;
        if (!field_key) {
            return res.status(400).json({ error: 'field_key is required' });
        }

        await prepareRun('INSERT INTO client_data (client_id, field_key, field_value, source) VALUES (?, ?, ?, ?)',
            parseInt(req.params.clientId), field_key, field_value || '', 'manual');

        const data = await prepareAll('SELECT * FROM client_data WHERE client_id = ? ORDER BY field_key', parseInt(req.params.clientId));
        res.json(data);
    } catch (err) {
        console.error('Error adding client data:', err);
        res.status(500).json({ error: 'Failed to add client data' });
    }
});

// DELETE /api/client-data/:id
router.delete('/client-data/:id', async (req, res) => {
    try {
        await prepareRun('DELETE FROM client_data WHERE id = ?', parseInt(req.params.id));
        res.json({ message: 'Data field deleted' });
    } catch (err) {
        console.error('Error deleting client data:', err);
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

module.exports = router;
