require('isomorphic-fetch');
const { Client } = require('@microsoft/microsoft-graph-client');
const { prepareGet, prepareRun, prepareAll } = require('../database');

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || 'common';
const AZURE_REDIRECT_URI = process.env.AZURE_REDIRECT_URI || 'http://localhost:3001/api/emails/callback';
const SCOPES = 'openid profile email offline_access Mail.Read Mail.ReadBasic';

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: AZURE_REDIRECT_URI,
    scope: SCOPES,
    response_mode: 'query',
  });
  return `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}

async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    code,
    redirect_uri: AZURE_REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: SCOPES,
  });

  const res = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || 'Token exchange failed');
  }
  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });

  const res = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) throw new Error('Token refresh failed');
  return res.json();
}

function getGraphClient(accessToken) {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

async function getValidToken(userId) {
  const settings = await prepareGet('SELECT * FROM email_settings WHERE user_id = ? AND is_connected = true', userId);
  if (!settings) return null;

  const now = new Date();
  const expires = new Date(settings.token_expires_at);

  if (now >= expires) {
    try {
      const tokens = await refreshAccessToken(settings.refresh_token);
      const newExpires = new Date(Date.now() + tokens.expires_in * 1000);
      await prepareRun(
        'UPDATE email_settings SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?',
        tokens.access_token, tokens.refresh_token || settings.refresh_token, newExpires.toISOString(), settings.id
      );
      return tokens.access_token;
    } catch (err) {
      console.error('Token refresh failed:', err);
      await prepareRun('UPDATE email_settings SET is_connected = false WHERE id = ?', settings.id);
      return null;
    }
  }

  return settings.access_token;
}

async function syncClientEmails(userId, clientId) {
  const token = await getValidToken(userId);
  if (!token) throw new Error('Not connected to Outlook');

  const client = await prepareGet('SELECT email FROM clients WHERE id = ?', clientId);
  if (!client?.email) throw new Error('Client has no email address');

  const graphClient = getGraphClient(token);

  try {
    const messages = await graphClient
      .api('/me/messages')
      .filter(`from/emailAddress/address eq '${client.email}' or toRecipients/any(r: r/emailAddress/address eq '${client.email}')`)
      .select('id,subject,from,bodyPreview,receivedDateTime,hasAttachments,parentFolderId')
      .top(50)
      .orderby('receivedDateTime desc')
      .get();

    let synced = 0;
    for (const msg of messages.value || []) {
      try {
        await prepareRun(
          `INSERT INTO client_emails (client_id, message_id, from_email, from_name, subject, body_preview, received_at, has_attachments, folder)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(message_id) DO NOTHING`,
          clientId,
          msg.id,
          msg.from?.emailAddress?.address || '',
          msg.from?.emailAddress?.name || '',
          msg.subject || '(No subject)',
          msg.bodyPreview || '',
          msg.receivedDateTime,
          msg.hasAttachments || false,
          msg.parentFolderId || 'inbox'
        );
        synced++;
      } catch (e) {
        // Skip duplicates
      }
    }
    return { synced, total: messages.value?.length || 0 };
  } catch (err) {
    console.error('Email sync error:', err);
    throw new Error('Failed to sync emails from Outlook');
  }
}

async function syncAllClientEmails(userId) {
  const token = await getValidToken(userId);
  if (!token) throw new Error('Not connected to Outlook');

  const clients = await prepareAll('SELECT id, email FROM clients WHERE email IS NOT NULL AND email != \'\'');
  const graphClient = getGraphClient(token);
  let totalSynced = 0;

  // Fetch recent emails in bulk
  try {
    const messages = await graphClient
      .api('/me/messages')
      .select('id,subject,from,bodyPreview,receivedDateTime,hasAttachments,parentFolderId,toRecipients')
      .top(200)
      .orderby('receivedDateTime desc')
      .get();

    const clientEmailMap = {};
    for (const c of clients) {
      if (c.email) clientEmailMap[c.email.toLowerCase()] = c.id;
    }

    for (const msg of messages.value || []) {
      const fromEmail = msg.from?.emailAddress?.address?.toLowerCase();
      const toEmails = (msg.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());

      let matchedClientId = clientEmailMap[fromEmail];
      if (!matchedClientId) {
        for (const to of toEmails) {
          if (clientEmailMap[to]) { matchedClientId = clientEmailMap[to]; break; }
        }
      }

      if (matchedClientId) {
        try {
          await prepareRun(
            `INSERT INTO client_emails (client_id, message_id, from_email, from_name, subject, body_preview, received_at, has_attachments, folder)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(message_id) DO NOTHING`,
            matchedClientId,
            msg.id,
            msg.from?.emailAddress?.address || '',
            msg.from?.emailAddress?.name || '',
            msg.subject || '(No subject)',
            msg.bodyPreview || '',
            msg.receivedDateTime,
            msg.hasAttachments || false,
            msg.parentFolderId || 'inbox'
          );
          totalSynced++;
        } catch {}
      }
    }
  } catch (err) {
    console.error('Bulk email sync error:', err);
    throw new Error('Failed to sync emails');
  }

  return { synced: totalSynced };
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidToken,
  syncClientEmails,
  syncAllClientEmails,
};
