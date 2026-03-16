const { prepareRun } = require('../database');

/**
 * Log a single audit entry
 */
async function logAudit(req, { clientId, entityType, entityId, action, fieldKey, oldValue, newValue }) {
    try {
        await prepareRun(
            `INSERT INTO audit_logs (client_id, entity_type, entity_id, action, field_key, old_value, new_value, changed_by, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            clientId || null,
            entityType,
            entityId || null,
            action,
            fieldKey || null,
            oldValue != null ? String(oldValue) : null,
            newValue != null ? String(newValue) : null,
            req.user?.id || null,
            req.ip || null
        );
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

/**
 * Log multiple field changes in bulk
 */
async function logBulkChanges(req, { clientId, entityType, entityId, action, changes }) {
    for (const change of changes) {
        await logAudit(req, {
            clientId,
            entityType,
            entityId,
            action,
            fieldKey: change.fieldKey,
            oldValue: change.oldValue,
            newValue: change.newValue,
        });
    }
}

module.exports = { logAudit, logBulkChanges };
