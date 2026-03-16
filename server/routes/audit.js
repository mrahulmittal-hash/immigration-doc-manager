const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet } = require('../database');

// GET /api/clients/:id/audit — audit log for a specific client
router.get('/clients/:id/audit', async (req, res) => {
    const clientId = parseInt(req.params.id);
    const { entity_type, action, limit = 50, offset = 0 } = req.query;

    try {
        let sql = `
            SELECT a.*, u.name as changed_by_name
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.changed_by
            WHERE a.client_id = $1
        `;
        const params = [clientId];
        let paramIdx = 2;

        if (entity_type) {
            sql += ` AND a.entity_type = $${paramIdx}`;
            params.push(entity_type);
            paramIdx++;
        }
        if (action) {
            sql += ` AND a.action = $${paramIdx}`;
            params.push(action);
            paramIdx++;
        }

        sql += ` ORDER BY a.changed_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const logs = await prepareAll(sql, ...params);
        const countResult = await prepareGet(
            'SELECT COUNT(*) as total FROM audit_logs WHERE client_id = $1',
            clientId
        );

        res.json({ logs, total: parseInt(countResult?.total || 0) });
    } catch (err) {
        console.error('Error fetching audit log:', err);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

// GET /api/audit/recent — recent audit entries across all clients
router.get('/audit/recent', async (req, res) => {
    const { limit = 20 } = req.query;
    try {
        const logs = await prepareAll(`
            SELECT a.*, u.name as changed_by_name, c.first_name, c.last_name
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.changed_by
            LEFT JOIN clients c ON c.id = a.client_id
            ORDER BY a.changed_at DESC
            LIMIT $1
        `, parseInt(limit));
        res.json(logs);
    } catch (err) {
        console.error('Error fetching recent audit:', err);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

module.exports = router;
