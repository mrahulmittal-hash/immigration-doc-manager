/**
 * DocuSign Integration Service
 * Handles OAuth, envelope creation, webhook validation, and document retrieval
 */

const { prepareGet, prepareRun } = require('../database');
const https = require('https');
const crypto = require('crypto');

// ── Settings Cache ──────────────────────────────────────────
let _settingsCache = null;
let _settingsCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

async function getSettings() {
  if (_settingsCache && Date.now() - _settingsCacheTime < CACHE_TTL) return _settingsCache;
  _settingsCache = await prepareGet('SELECT * FROM signing_settings WHERE id = 1');
  _settingsCacheTime = Date.now();
  return _settingsCache;
}

function clearSettingsCache() {
  _settingsCache = null;
  _settingsCacheTime = 0;
}

// ── OAuth / Access Token ────────────────────────────────────
async function getAccessToken() {
  const settings = await getSettings();
  if (!settings) throw new Error('Signing settings not configured');
  if (settings.provider !== 'docusign') throw new Error('DocuSign is not the active signing provider');

  // Check if we have a valid cached token
  if (settings.docusign_access_token && settings.docusign_token_expires) {
    const expires = new Date(settings.docusign_token_expires);
    if (expires > new Date(Date.now() + 60000)) {
      return settings.docusign_access_token;
    }
  }

  // Request new token using JWT Grant
  const { docusign_integration_key, docusign_secret, docusign_oauth_url } = settings;
  if (!docusign_integration_key || !docusign_secret) {
    throw new Error('DocuSign credentials not configured. Go to Admin → Signing Service to set up.');
  }

  return new Promise((resolve, reject) => {
    const authString = Buffer.from(`${docusign_integration_key}:${docusign_secret}`).toString('base64');
    const postData = 'grant_type=client_credentials&scope=signature';

    const url = new URL('/oauth/token', docusign_oauth_url);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200 || parsed.error) {
            return reject(new Error(parsed.error_description || parsed.error || `OAuth failed (${res.statusCode})`));
          }
          const expiresAt = new Date(Date.now() + (parsed.expires_in || 3600) * 1000);
          await prepareRun(
            `UPDATE signing_settings SET docusign_access_token = ?, docusign_token_expires = ?, updated_at = NOW() WHERE id = 1`,
            parsed.access_token, expiresAt.toISOString()
          );
          clearSettingsCache();
          resolve(parsed.access_token);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── Create and Send Envelope ────────────────────────────────
async function createAndSendEnvelope(htmlContent, signerName, signerEmail, agreementId, webhookUrl) {
  const settings = await getSettings();
  const token = await getAccessToken();
  const accountId = settings.docusign_account_id;

  if (!accountId) throw new Error('DocuSign Account ID not configured');

  // Convert HTML to a base64-encoded document
  // Wrap HTML in a complete document with styles for PDF rendering
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;margin:40px;font-size:13px;line-height:1.7;color:#1a1a1a}
h1{font-size:20px}h3{font-size:14px}ul{padding-left:24px}</style>
</head><body>${htmlContent}</body></html>`;

  const documentBase64 = Buffer.from(fullHtml).toString('base64');

  const envelope = {
    emailSubject: `Retainer Agreement — Please Sign`,
    emailBlurb: `Please review and sign the attached Retainer Agreement.`,
    status: 'sent',
    documents: [{
      documentBase64,
      name: 'Retainer Agreement',
      fileExtension: 'html',
      documentId: '1',
    }],
    recipients: {
      signers: [{
        email: signerEmail,
        name: signerName,
        recipientId: '1',
        routingOrder: '1',
        tabs: {
          signHereTabs: [{
            anchorString: 'Signature: ______________________________',
            anchorUnits: 'pixels',
            anchorXOffset: '100',
            anchorYOffset: '-5',
            recipientId: '1',
          }],
          dateSignedTabs: [{
            anchorString: 'Date: ______________________________',
            anchorUnits: 'pixels',
            anchorXOffset: '60',
            anchorYOffset: '-5',
            recipientId: '1',
          }],
        },
      }],
    },
  };

  // Add webhook notification if URL provided
  if (webhookUrl) {
    envelope.eventNotification = {
      url: webhookUrl,
      loggingEnabled: true,
      requireAcknowledgment: true,
      envelopeEvents: [
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined' },
        { envelopeEventStatusCode: 'voided' },
      ],
    };
  }

  return new Promise((resolve, reject) => {
    const baseUrl = new URL(settings.docusign_base_url);
    const postData = JSON.stringify(envelope);
    const options = {
      hostname: baseUrl.hostname,
      path: `/restapi/v2.1/accounts/${accountId}/envelopes`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            return reject(new Error(parsed.message || parsed.errorCode || `DocuSign API error (${res.statusCode})`));
          }
          resolve({
            envelopeId: parsed.envelopeId,
            status: parsed.status,
            statusDateTime: parsed.statusDateTime,
          });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── Get Envelope Status ─────────────────────────────────────
async function getEnvelopeStatus(envelopeId) {
  const settings = await getSettings();
  const token = await getAccessToken();
  const accountId = settings.docusign_account_id;

  return new Promise((resolve, reject) => {
    const baseUrl = new URL(settings.docusign_base_url);
    const options = {
      hostname: baseUrl.hostname,
      path: `/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: parsed.status, completedDateTime: parsed.completedDateTime });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Get Signed Document ─────────────────────────────────────
async function getSignedDocument(envelopeId) {
  const settings = await getSettings();
  const token = await getAccessToken();
  const accountId = settings.docusign_account_id;

  return new Promise((resolve, reject) => {
    const baseUrl = new URL(settings.docusign_base_url);
    const options = {
      hostname: baseUrl.hostname,
      path: `/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (res.statusCode >= 400) {
          return reject(new Error(`Failed to download signed document (${res.statusCode})`));
        }
        resolve(buffer);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Validate Webhook ────────────────────────────────────────
function validateWebhookPayload(body, hmacHeader, integrationKey) {
  if (!hmacHeader || !integrationKey) return true; // Skip validation if no HMAC configured
  const computedHmac = crypto
    .createHmac('sha256', integrationKey)
    .update(typeof body === 'string' ? body : JSON.stringify(body))
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(computedHmac));
}

// ── Test Connection ─────────────────────────────────────────
async function testConnection() {
  const settings = await getSettings();
  if (settings.provider !== 'docusign') {
    return { success: false, message: 'DocuSign is not the active provider' };
  }

  try {
    const token = await getAccessToken();
    // Verify by calling the userinfo endpoint
    return new Promise((resolve) => {
      const oauthUrl = new URL(settings.docusign_oauth_url);
      const options = {
        hostname: oauthUrl.hostname,
        path: '/oauth/userinfo',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const user = JSON.parse(data);
              resolve({ success: true, message: `Connected as ${user.name || user.email || 'DocuSign User'}`, user });
            } catch {
              resolve({ success: true, message: 'Connected to DocuSign' });
            }
          } else {
            resolve({ success: false, message: `Connection failed (${res.statusCode})` });
          }
        });
      });
      req.on('error', (e) => resolve({ success: false, message: e.message }));
      req.end();
    });
  } catch (e) {
    return { success: false, message: e.message };
  }
}

module.exports = {
  getSettings,
  clearSettingsCache,
  getAccessToken,
  createAndSendEnvelope,
  getEnvelopeStatus,
  getSignedDocument,
  validateWebhookPayload,
  testConnection,
};
