/**
 * emailIngestion.js — Admin routes for IMAP email integration configuration
 *
 * All routes require Admin role (enforced at mount level in server.js).
 */

const express = require('express');
const router = express.Router();
const { prepareGet, prepareRun } = require('../database');
const { encrypt, decrypt } = require('../services/encryptionService');
const { PROVIDER_PRESETS, testConnection, syncEmails, updateSchedule, stopScheduler } = require('../services/imapIngestionService');

const PASSWORD_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

// GET /admin/email-ingestion — get current config
router.get('/email-ingestion', async (req, res) => {
  try {
    const config = await prepareGet(
      'SELECT id, provider, imap_host, imap_port, imap_tls, email_address, sync_frequency, last_sync_at, last_sync_status, last_sync_error, is_active, created_at, updated_at FROM email_ingestion_config WHERE user_id = ? AND is_active = true',
      req.user?.id || 1
    );

    res.json({
      config: config ? { ...config, app_password: PASSWORD_MASK } : null,
      providers: PROVIDER_PRESETS,
    });
  } catch (err) {
    console.error('Get email ingestion config error:', err);
    res.status(500).json({ error: 'Failed to load email configuration' });
  }
});

// PUT /admin/email-ingestion — save/update config
router.put('/email-ingestion', async (req, res) => {
  try {
    const { provider, email_address, app_password, sync_frequency } = req.body;
    const userId = req.user?.id || 1;

    if (!provider || !email_address) {
      return res.status(400).json({ error: 'Provider and email address are required' });
    }

    const preset = PROVIDER_PRESETS[provider];
    if (!preset) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const existing = await prepareGet('SELECT id, app_password_enc, app_password_iv, app_password_tag FROM email_ingestion_config WHERE user_id = ?', userId);

    // Encrypt password if changed (not the mask)
    let enc, iv, tag;
    if (app_password && app_password !== PASSWORD_MASK) {
      const encrypted = encrypt(app_password);
      enc = encrypted.encrypted;
      iv = encrypted.iv;
      tag = encrypted.tag;
    } else if (existing) {
      enc = existing.app_password_enc;
      iv = existing.app_password_iv;
      tag = existing.app_password_tag;
    } else {
      return res.status(400).json({ error: 'App password is required for new configuration' });
    }

    if (existing) {
      await prepareRun(
        `UPDATE email_ingestion_config
         SET provider = ?, imap_host = ?, imap_port = ?, imap_tls = ?,
             email_address = ?, app_password_enc = ?, app_password_iv = ?, app_password_tag = ?,
             sync_frequency = ?, is_active = true, updated_at = NOW()
         WHERE id = ?`,
        provider, preset.host, preset.port, preset.tls,
        email_address, enc, iv, tag,
        sync_frequency || 'manual',
        existing.id
      );

      // Update scheduler
      updateSchedule(existing.id, sync_frequency || 'manual');

      res.json({ message: 'Email configuration updated successfully', id: existing.id });
    } else {
      const result = await prepareRun(
        `INSERT INTO email_ingestion_config
         (user_id, provider, imap_host, imap_port, imap_tls, email_address, app_password_enc, app_password_iv, app_password_tag, sync_frequency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userId, provider, preset.host, preset.port, preset.tls,
        email_address, enc, iv, tag,
        sync_frequency || 'manual'
      );

      const newId = result.lastInsertRowid;
      // Start scheduler if not manual
      if (sync_frequency && sync_frequency !== 'manual') {
        updateSchedule(newId, sync_frequency);
      }

      res.json({ message: 'Email configuration saved successfully', id: newId });
    }
  } catch (err) {
    console.error('Save email ingestion config error:', err);
    res.status(500).json({ error: 'Failed to save email configuration' });
  }
});

// POST /admin/email-ingestion/test — test IMAP connection
router.post('/email-ingestion/test', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { provider, email_address, app_password } = req.body;

    let host, port, tls, password;

    if (provider && email_address && app_password && app_password !== PASSWORD_MASK) {
      // Test with provided credentials (before saving)
      const preset = PROVIDER_PRESETS[provider];
      if (!preset) return res.status(400).json({ error: 'Invalid provider' });
      host = preset.host;
      port = preset.port;
      tls = preset.tls;
      password = app_password;
    } else {
      // Test with saved credentials
      const config = await prepareGet(
        'SELECT * FROM email_ingestion_config WHERE user_id = ? AND is_active = true',
        userId
      );
      if (!config) return res.status(400).json({ error: 'No email configuration found. Save settings first.' });

      host = config.imap_host;
      port = config.imap_port;
      tls = config.imap_tls;
      password = decrypt(config.app_password_enc, config.app_password_iv, config.app_password_tag);
      email_address || (email_address = config.email_address);
    }

    const result = await testConnection({ host, port, tls, email: email_address, password });
    res.json(result);
  } catch (err) {
    console.error('Test email connection error:', err);
    res.json({ success: false, message: err.message || 'Connection test failed' });
  }
});

// POST /admin/email-ingestion/sync — manual sync trigger
router.post('/email-ingestion/sync', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const config = await prepareGet(
      'SELECT id FROM email_ingestion_config WHERE user_id = ? AND is_active = true',
      userId
    );
    if (!config) return res.status(400).json({ error: 'No email configuration found' });

    const result = await syncEmails(config.id);
    res.json({
      message: `Synced ${result.synced} email(s), saved ${result.attachments} attachment(s)`,
      ...result,
    });
  } catch (err) {
    console.error('Email sync error:', err);
    res.status(500).json({ error: err.message || 'Email sync failed' });
  }
});

// DELETE /admin/email-ingestion — disconnect
router.delete('/email-ingestion', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const config = await prepareGet('SELECT id FROM email_ingestion_config WHERE user_id = ?', userId);
    if (config) {
      await prepareRun('UPDATE email_ingestion_config SET is_active = false, updated_at = NOW() WHERE id = ?', config.id);
      stopScheduler(config.id);
    }
    res.json({ message: 'Email integration disconnected' });
  } catch (err) {
    console.error('Disconnect email error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
