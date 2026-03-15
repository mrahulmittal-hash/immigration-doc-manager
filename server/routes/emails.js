const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');
const outlook = require('../services/outlookService');

// GET /emails/connect — redirect to Microsoft OAuth
router.get('/emails/connect', (req, res) => {
  if (!process.env.AZURE_CLIENT_ID) {
    return res.status(400).json({ error: 'Azure AD not configured. Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID in .env' });
  }
  const url = outlook.getAuthUrl();
  res.json({ auth_url: url });
});

// GET /emails/callback — handle OAuth callback
router.get('/emails/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing authorization code');

    const tokens = await outlook.exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Get user email from token (decode JWT payload)
    let email = '';
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
      email = payload.preferred_username || payload.email || '';
    } catch {}

    // Default user_id = 1 (admin) — in production this would come from session
    const userId = 1;

    const existing = await prepareGet('SELECT id FROM email_settings WHERE user_id = ?', userId);
    if (existing) {
      await prepareRun(
        'UPDATE email_settings SET access_token = ?, refresh_token = ?, token_expires_at = ?, email_address = ?, is_connected = true WHERE id = ?',
        tokens.access_token, tokens.refresh_token, expiresAt.toISOString(), email, existing.id
      );
    } else {
      await prepareRun(
        'INSERT INTO email_settings (user_id, access_token, refresh_token, token_expires_at, email_address, is_connected) VALUES (?, ?, ?, ?, ?, true)',
        userId, tokens.access_token, tokens.refresh_token, expiresAt.toISOString(), email
      );
    }

    // Redirect back to app settings
    res.redirect('/settings/email?connected=true');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/settings/email?error=' + encodeURIComponent(err.message));
  }
});

// GET /emails/status — check connection status
router.get('/emails/status', async (req, res) => {
  try {
    const settings = await prepareGet('SELECT email_address, is_connected, token_expires_at FROM email_settings WHERE user_id = 1');
    res.json({
      connected: settings?.is_connected || false,
      email: settings?.email_address || null,
      configured: !!process.env.AZURE_CLIENT_ID,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check email status' });
  }
});

// POST /emails/disconnect
router.post('/emails/disconnect', async (req, res) => {
  try {
    await prepareRun('UPDATE email_settings SET is_connected = false, access_token = NULL, refresh_token = NULL WHERE user_id = 1');
    res.json({ message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// POST /emails/sync — sync all client emails
router.post('/emails/sync', async (req, res) => {
  try {
    const result = await outlook.syncAllClientEmails(1);
    res.json({ message: `Synced ${result.synced} emails`, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /clients/:id/emails/sync — sync emails for a specific client
router.post('/clients/:id/emails/sync', async (req, res) => {
  try {
    const result = await outlook.syncClientEmails(1, req.params.id);
    res.json({ message: `Synced ${result.synced} emails`, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /clients/:id/emails — get synced emails for a client
router.get('/clients/:id/emails', async (req, res) => {
  try {
    const emails = await prepareAll(
      'SELECT * FROM client_emails WHERE client_id = ? ORDER BY received_at DESC',
      req.params.id
    );
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

module.exports = router;
