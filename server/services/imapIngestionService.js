/**
 * imapIngestionService.js — Multi-provider IMAP email ingestion
 *
 * Connects to any IMAP email server (Gmail, Outlook, Yahoo, etc.) using app passwords,
 * reads incoming emails from registered clients, downloads attachments, and saves
 * them as documents in the client's profile.
 */

const { ImapFlow } = require('imapflow');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { decrypt } = require('./encryptionService');
const { isS3Enabled, uploadToS3 } = require('./storageService');
const { createWorkflowTask } = require('./autoTaskService');

// ---------------------------------------------------------------------------
// Provider presets
// ---------------------------------------------------------------------------
const PROVIDER_PRESETS = {
  gmail:           { host: 'imap.gmail.com',       port: 993, tls: true, label: 'Gmail',            description: 'Personal Gmail account (requires App Password)' },
  gmail_workspace: { host: 'imap.gmail.com',       port: 993, tls: true, label: 'Gmail Workspace',  description: 'Google Workspace / G Suite business email' },
  outlook:         { host: 'outlook.office365.com', port: 993, tls: true, label: 'Outlook / Hotmail', description: 'Microsoft Outlook, Hotmail, or Live email' },
  yahoo:           { host: 'imap.mail.yahoo.com',  port: 993, tls: true, label: 'Yahoo Mail',       description: 'Personal Yahoo Mail account' },
  yahoo_business:  { host: 'imap.mail.yahoo.com',  port: 993, tls: true, label: 'Yahoo Business',   description: 'Yahoo Business / AT&T email' },
  turbify:         { host: 'imap.mail.yahoo.com',  port: 993, tls: true, label: 'Turbify Mail',     description: 'Turbify (formerly Yahoo Small Business) email' },
};

// Allowed attachment extensions
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff']);
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB

// Active cron jobs keyed by config ID
const activeJobs = new Map();

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------
/**
 * Test an IMAP connection with the given credentials.
 * @param {{ host: string, port: number, tls: boolean, email: string, password: string }} opts
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
async function testConnection({ host, port, tls, email, password }) {
  const client = new ImapFlow({
    host,
    port,
    secure: tls,
    auth: { user: email, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.logout();
    return { success: true, message: 'Connection successful! IMAP credentials are valid.' };
  } catch (err) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

// ---------------------------------------------------------------------------
// Core sync
// ---------------------------------------------------------------------------
/**
 * Sync emails from a configured IMAP account.
 * Downloads attachments from emails sent by known clients and saves them as documents.
 *
 * @param {number} configId - ID in email_ingestion_config table
 * @returns {Promise<{ synced: number, attachments: number, errors: string[] }>}
 */
async function syncEmails(configId) {
  const config = await prepareGet('SELECT * FROM email_ingestion_config WHERE id = ? AND is_active = true', configId);
  if (!config) throw new Error('Email configuration not found or inactive');

  // Decrypt app password
  const password = decrypt(config.app_password_enc, config.app_password_iv, config.app_password_tag);

  // Build client email → { id, name } map
  const clients = await prepareAll("SELECT id, email, first_name, last_name FROM clients WHERE email IS NOT NULL AND email != ''");
  const clientMap = new Map();
  for (const c of clients) {
    if (c.email) clientMap.set(c.email.toLowerCase(), { id: c.id, name: `${c.first_name} ${c.last_name}`.trim() });
  }

  const imapClient = new ImapFlow({
    host: config.imap_host,
    port: config.imap_port,
    secure: config.imap_tls,
    auth: { user: config.email_address, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  let synced = 0;
  let attachmentCount = 0;
  const errors = [];

  try {
    await imapClient.connect();

    const lock = await imapClient.getMailboxLock('INBOX');
    try {
      // Determine search date: last sync or 30 days ago
      const sinceDate = config.last_sync_at
        ? new Date(config.last_sync_at)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Search for messages since the date
      const messages = imapClient.fetch(
        { since: sinceDate },
        {
          uid: true,
          envelope: true,
          bodyStructure: true,
        }
      );

      for await (const msg of messages) {
        try {
          const uid = String(msg.uid);

          // Check if already processed
          const existing = await prepareGet(
            'SELECT id FROM processed_emails WHERE config_id = ? AND message_uid = ?',
            configId, uid
          );
          if (existing) continue;

          // Get sender email
          const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase();
          if (!fromAddr) continue;

          // Match to client
          const clientInfo = clientMap.get(fromAddr);

          // Extract attachments if client matched and message has attachments
          let attCount = 0;
          if (clientInfo && msg.bodyStructure) {
            const parts = flattenParts(msg.bodyStructure);
            const attachmentParts = parts.filter(p =>
              p.disposition === 'attachment' ||
              (p.disposition === 'inline' && p.type !== 'text')
            );

            for (const part of attachmentParts) {
              try {
                const filename = part.parameters?.name || part.dispositionParameters?.filename || `attachment_${uuidv4()}`;
                const ext = path.extname(filename).toLowerCase();

                if (!ALLOWED_EXTENSIONS.has(ext)) continue;
                if (part.size && part.size > MAX_ATTACHMENT_SIZE) continue;

                // Download the attachment
                const { content } = await imapClient.download(msg.seq, part.part, { uid: false });
                const chunks = [];
                for await (const chunk of content) {
                  chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);

                // Save via storage service
                const storedFilename = `${uuidv4()}${ext}`;
                let filePath;

                if (isS3Enabled()) {
                  const result = await uploadToS3(buffer, filename, 'email-documents', clientInfo.id);
                  filePath = result.location;
                } else {
                  const dir = path.join(__dirname, '..', 'uploads', 'email-documents');
                  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                  const fullPath = path.join(dir, storedFilename);
                  fs.writeFileSync(fullPath, buffer);
                  filePath = fullPath;
                }

                // Insert document record
                await prepareRun(
                  `INSERT INTO documents (client_id, filename, original_name, file_path, file_type, file_size, category, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  clientInfo.id,
                  storedFilename,
                  filename,
                  filePath,
                  mimeFromExt(ext),
                  buffer.length,
                  'email-attachment',
                  'email'
                );

                attCount++;
                attachmentCount++;
              } catch (attErr) {
                errors.push(`Attachment error (UID ${uid}): ${attErr.message}`);
              }
            }

            // Create workflow task if we got new documents
            if (attCount > 0) {
              try {
                await createWorkflowTask(clientInfo.id, {
                  title: `Review ${attCount} email document(s) from ${clientInfo.name}`,
                  category: 'Document Review',
                  priority: 'medium',
                  dueDays: 3,
                  createFollowUp: false,
                });
              } catch (taskErr) {
                // Non-critical — don't fail the sync
                console.error('Task creation error:', taskErr.message);
              }
            }
          }

          // Record as processed (even if no match — prevents re-scanning)
          await prepareRun(
            `INSERT INTO processed_emails (config_id, message_uid, message_id, client_id, from_email, subject, received_at, attachments_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(config_id, message_uid) DO NOTHING`,
            configId,
            uid,
            msg.envelope?.messageId || '',
            clientInfo?.id || null,
            fromAddr,
            msg.envelope?.subject || '(No subject)',
            msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString(),
            attCount
          );

          synced++;
        } catch (msgErr) {
          errors.push(`Message error: ${msgErr.message}`);
        }
      }
    } finally {
      lock.release();
    }

    await imapClient.logout();
  } catch (connErr) {
    // Update status with error
    await prepareRun(
      "UPDATE email_ingestion_config SET last_sync_at = NOW(), last_sync_status = 'error', last_sync_error = ?, updated_at = NOW() WHERE id = ?",
      connErr.message, configId
    );
    throw connErr;
  }

  // Update status with success
  await prepareRun(
    "UPDATE email_ingestion_config SET last_sync_at = NOW(), last_sync_status = 'success', last_sync_error = NULL, updated_at = NOW() WHERE id = ?",
    configId
  );

  return { synced, attachments: attachmentCount, errors };
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------
const FREQUENCY_CRON = {
  '15min': '*/15 * * * *',
  '30min': '*/30 * * * *',
  '1hr':   '0 * * * *',
  '2hr':   '0 */2 * * *',
};

/**
 * Start scheduled sync for all active configs.
 * Called once on server boot.
 */
async function startScheduler() {
  try {
    const configs = await prepareAll(
      "SELECT id, sync_frequency FROM email_ingestion_config WHERE is_active = true AND sync_frequency != 'manual'"
    );

    for (const config of configs) {
      scheduleJob(config.id, config.sync_frequency);
    }

    if (configs.length > 0) {
      console.log(`📧 Email ingestion: started ${configs.length} scheduled sync job(s)`);
    }
  } catch (err) {
    console.error('Email scheduler init failed:', err.message);
  }
}

/**
 * Update the schedule for a specific config.
 * @param {number} configId
 * @param {string} frequency - 'manual', '15min', '30min', '1hr', '2hr'
 */
function updateSchedule(configId, frequency) {
  // Stop existing job
  stopScheduler(configId);

  // Start new job if not manual
  if (frequency !== 'manual' && FREQUENCY_CRON[frequency]) {
    scheduleJob(configId, frequency);
  }
}

/**
 * Stop the scheduler for a specific config.
 * @param {number} configId
 */
function stopScheduler(configId) {
  const job = activeJobs.get(configId);
  if (job) {
    job.stop();
    activeJobs.delete(configId);
  }
}

function scheduleJob(configId, frequency) {
  const cronExpr = FREQUENCY_CRON[frequency];
  if (!cronExpr) return;

  const job = cron.schedule(cronExpr, async () => {
    try {
      console.log(`📧 Email sync starting for config ${configId}...`);
      const result = await syncEmails(configId);
      console.log(`📧 Email sync done: ${result.synced} emails, ${result.attachments} attachments`);
    } catch (err) {
      console.error(`📧 Email sync failed for config ${configId}:`, err.message);
    }
  });

  activeJobs.set(configId, job);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a MIME body structure into a flat list of parts with their part IDs.
 */
function flattenParts(structure, prefix = '') {
  const parts = [];

  if (structure.childNodes && structure.childNodes.length > 0) {
    structure.childNodes.forEach((child, i) => {
      const partId = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      parts.push(...flattenParts(child, partId));
    });
  } else {
    parts.push({
      part: prefix || '1',
      type: structure.type,
      subtype: structure.subtype,
      disposition: structure.disposition,
      parameters: structure.parameters || {},
      dispositionParameters: structure.dispositionParameters || {},
      size: structure.size || 0,
    });
  }

  return parts;
}

function mimeFromExt(ext) {
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  PROVIDER_PRESETS,
  testConnection,
  syncEmails,
  startScheduler,
  updateSchedule,
  stopScheduler,
};
