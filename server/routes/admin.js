const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { mergeTemplate, calculateAdjustedFee } = require('../services/retainerTemplateService');
const { sendRetainerAgreementEmail } = require('../services/emailService');
const docusignService = require('../services/docusignService');

// ═══════════════════════════════════════════════════════════════
// SERVICE FEES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/service-fees — all fees (active + inactive)
router.get('/service-fees', async (req, res) => {
  try {
    const rows = await prepareAll('SELECT * FROM service_fees ORDER BY is_active DESC, service_name');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching service fees:', err);
    res.status(500).json({ error: 'Failed to fetch service fees' });
  }
});

// POST /api/admin/service-fees — create
router.post('/service-fees', async (req, res) => {
  try {
    const { service_name, base_fee, gst_rate, description } = req.body;
    if (!service_name) return res.status(400).json({ error: 'Service name is required' });
    const result = await prepareRun(
      'INSERT INTO service_fees (service_name, base_fee, gst_rate, description) VALUES (?, ?, ?, ?)',
      service_name, base_fee || 0, gst_rate || 5.00, description || ''
    );
    res.json({ id: result.lastInsertRowid, message: 'Service fee created' });
  } catch (err) {
    console.error('Error creating service fee:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/service-fees/:id — update
router.put('/service-fees/:id', async (req, res) => {
  try {
    const { service_name, base_fee, gst_rate, description, is_active } = req.body;
    await prepareRun(
      'UPDATE service_fees SET service_name = ?, base_fee = ?, gst_rate = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      service_name, base_fee, gst_rate, description, is_active !== false, req.params.id
    );
    res.json({ message: 'Service fee updated' });
  } catch (err) {
    console.error('Error updating service fee:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/service-fees/:id — soft delete
router.delete('/service-fees/:id', async (req, res) => {
  try {
    await prepareRun('UPDATE service_fees SET is_active = false, updated_at = NOW() WHERE id = ?', req.params.id);
    res.json({ message: 'Service fee deactivated' });
  } catch (err) {
    console.error('Error deleting service fee:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// RETAINER TEMPLATE
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/retainer-template — all sections
router.get('/retainer-template', async (req, res) => {
  try {
    const rows = await prepareAll('SELECT * FROM retainer_template_sections ORDER BY section_number');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching template:', err);
    res.status(500).json({ error: 'Failed to fetch retainer template' });
  }
});

// PUT /api/admin/retainer-template/:sectionNumber — update section content
router.put('/retainer-template/:sectionNumber', async (req, res) => {
  try {
    const { content, title } = req.body;
    if (content === undefined) return res.status(400).json({ error: 'Content is required' });
    let sql = 'UPDATE retainer_template_sections SET content = ?, updated_at = NOW()';
    const params = [content];
    if (title) { sql += ', title = ?'; params.push(title); }
    sql += ' WHERE section_number = ?';
    params.push(req.params.sectionNumber);
    await prepareRun(sql, ...params);
    res.json({ message: 'Section updated' });
  } catch (err) {
    console.error('Error updating template section:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/retainer-template/preview — preview with sample data
router.post('/retainer-template/preview', async (req, res) => {
  try {
    const sections = await prepareAll('SELECT * FROM retainer_template_sections ORDER BY section_number');
    const firm = await prepareGet('SELECT * FROM firm_profile WHERE id = 1') || {};
    const sampleClient = { first_name: 'John', last_name: 'Doe', date_of_birth: '1990-01-15', phone: '647-555-0000', email: 'john.doe@example.com', nationality: 'Indian', visa_type: 'Express Entry' };
    const sampleFee = { service_name: 'Permanent Residence - Express Entry', base_fee: 3500, gst_rate: 5 };
    const html = mergeTemplate(sections, sampleClient, sampleFee, firm, []);
    res.json({ html });
  } catch (err) {
    console.error('Error previewing template:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FIRM PROFILE
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/firm-profile
router.get('/firm-profile', async (req, res) => {
  try {
    const row = await prepareGet('SELECT * FROM firm_profile WHERE id = 1');
    res.json(row || {});
  } catch (err) {
    console.error('Error fetching firm profile:', err);
    res.status(500).json({ error: 'Failed to fetch firm profile' });
  }
});

// PUT /api/admin/firm-profile
router.put('/firm-profile', async (req, res) => {
  try {
    const { rcic_name, rcic_license, business_name, address, city, province, postal_code, phone, email } = req.body;
    await prepareRun(
      `UPDATE firm_profile SET rcic_name = ?, rcic_license = ?, business_name = ?, address = ?, city = ?, province = ?, postal_code = ?, phone = ?, email = ?, updated_at = NOW() WHERE id = 1`,
      rcic_name || '', rcic_license || '', business_name || '', address || '', city || '', province || '', postal_code || '', phone || '', email || ''
    );
    res.json({ message: 'Firm profile updated' });
  } catch (err) {
    console.error('Error updating firm profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FEE ADJUSTMENTS (mounted under /api, not /api/admin)
// ═══════════════════════════════════════════════════════════════

// GET /api/clients/:clientId/fee-adjustments
router.get('/clients/:clientId/fee-adjustments', async (req, res) => {
  try {
    const rows = await prepareAll(
      'SELECT fa.*, u.name as created_by_name FROM fee_adjustments fa LEFT JOIN users u ON fa.created_by = u.id WHERE fa.client_id = ? ORDER BY fa.created_at DESC',
      req.params.clientId
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/:clientId/fee-adjustments
router.post('/clients/:clientId/fee-adjustments', async (req, res) => {
  try {
    const { retainer_id, type, amount, percentage, description } = req.body;
    if (!type || !['discount', 'waiver', 'surcharge'].includes(type)) {
      return res.status(400).json({ error: 'Type must be discount, waiver, or surcharge' });
    }
    const result = await prepareRun(
      'INSERT INTO fee_adjustments (retainer_id, client_id, type, amount, percentage, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      retainer_id || null, req.params.clientId, type, amount || 0, percentage || 0, description || '', req.user?.id || null
    );
    res.json({ id: result.lastInsertRowid, message: 'Adjustment created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fee-adjustments/:id
router.delete('/fee-adjustments/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM fee_adjustments WHERE id = ?', req.params.id);
    res.json({ message: 'Adjustment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/retainers/:id/adjusted-total
router.get('/retainers/:id/adjusted-total', async (req, res) => {
  try {
    const retainer = await prepareGet('SELECT * FROM retainers WHERE id = ?', req.params.id);
    if (!retainer) return res.status(404).json({ error: 'Retainer not found' });
    const adjustments = await prepareAll('SELECT * FROM fee_adjustments WHERE retainer_id = ?', req.params.id);
    const calc = calculateAdjustedFee(Number(retainer.retainer_fee), 5, adjustments);
    res.json(calc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// RETAINER AGREEMENT GENERATION
// ═══════════════════════════════════════════════════════════════

// POST /api/clients/:clientId/retainer-agreement/generate
router.post('/clients/:clientId/retainer-agreement/generate', async (req, res) => {
  try {
    const { retainer_id } = req.body;
    const clientId = req.params.clientId;

    const clientData = await prepareGet('SELECT * FROM clients WHERE id = ?', clientId);
    if (!clientData) return res.status(404).json({ error: 'Client not found' });

    const sections = await prepareAll('SELECT * FROM retainer_template_sections ORDER BY section_number');
    const firm = await prepareGet('SELECT * FROM firm_profile WHERE id = 1') || {};

    let feeData = { service_name: clientData.visa_type, base_fee: 0, gst_rate: 5 };
    let adjustments = [];

    // If no retainer_id provided, auto-find the client's most recent retainer
    let effectiveRetainerId = retainer_id;
    if (!effectiveRetainerId) {
      const latestRetainer = await prepareGet('SELECT id FROM retainers WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', clientId);
      if (latestRetainer) effectiveRetainerId = latestRetainer.id;
    }

    if (effectiveRetainerId) {
      const retainer = await prepareGet('SELECT * FROM retainers WHERE id = ?', effectiveRetainerId);
      if (retainer) {
        feeData = { service_name: retainer.service_type, base_fee: Number(retainer.retainer_fee), gst_rate: 5 };
        // Try to get GST rate from service_fees
        const sf = await prepareGet('SELECT gst_rate FROM service_fees WHERE service_name = ?', retainer.service_type);
        if (sf) feeData.gst_rate = Number(sf.gst_rate);
        adjustments = await prepareAll('SELECT * FROM fee_adjustments WHERE retainer_id = ?', effectiveRetainerId);
      }
    } else {
      // No retainer exists — try to get fee from service_fees table based on visa_type
      const sf = await prepareGet('SELECT * FROM service_fees WHERE service_name = ? AND is_active = true', clientData.visa_type);
      if (sf) {
        feeData = { service_name: sf.service_name, base_fee: Number(sf.base_fee), gst_rate: Number(sf.gst_rate) };
      }
    }

    const html = mergeTemplate(sections, clientData, feeData, firm, adjustments);

    const result = await prepareRun(
      'INSERT INTO client_retainer_agreements (client_id, retainer_id, generated_html) VALUES (?, ?, ?)',
      clientId, effectiveRetainerId || null, html
    );

    res.json({ id: result.lastInsertRowid, html, message: 'Agreement generated' });
  } catch (err) {
    console.error('Error generating agreement:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:clientId/retainer-agreements
router.get('/clients/:clientId/retainer-agreements', async (req, res) => {
  try {
    const rows = await prepareAll(
      'SELECT id, client_id, retainer_id, status, generated_at, signed_at FROM client_retainer_agreements WHERE client_id = ? ORDER BY generated_at DESC',
      req.params.clientId
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/retainer-agreements/:id
router.get('/retainer-agreements/:id', async (req, res) => {
  try {
    const row = await prepareGet('SELECT * FROM client_retainer_agreements WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Agreement not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/retainer-agreements/:id/send-email — send agreement via email
router.post('/retainer-agreements/:id/send-email', async (req, res) => {
  try {
    const agreement = await prepareGet('SELECT * FROM client_retainer_agreements WHERE id = ?', req.params.id);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', agreement.client_id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.email) return res.status(400).json({ error: 'Client has no email address on file' });

    const clientName = `${client.first_name} ${client.last_name}`;
    const serviceName = client.visa_type || 'Immigration Services';

    const result = await sendRetainerAgreementEmail(client.email, clientName, agreement.generated_html, serviceName);

    // Update agreement status to 'sent'
    await prepareRun('UPDATE client_retainer_agreements SET status = ? WHERE id = ? AND status = ?', 'sent', req.params.id, 'draft');

    res.json({ message: `Agreement sent to ${client.email}`, ...result });
  } catch (err) {
    console.error('Error sending retainer agreement email:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SIGNING SETTINGS
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/signing-settings
router.get('/admin/signing-settings', async (req, res) => {
  try {
    const settings = await prepareGet('SELECT * FROM signing_settings WHERE id = 1');
    if (!settings) return res.json({ provider: 'builtin' });
    // Mask sensitive credentials for display
    res.json({
      ...settings,
      docusign_secret: settings.docusign_secret ? '••••••••' : '',
      docusign_access_token: undefined,
      docusign_refresh_token: undefined,
      docusign_token_expires: undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/signing-settings
router.put('/admin/signing-settings', async (req, res) => {
  try {
    const { provider, docusign_account_id, docusign_integration_key, docusign_secret, docusign_base_url, docusign_oauth_url } = req.body;
    const fields = [];
    const values = [];

    if (provider !== undefined) { fields.push('provider = ?'); values.push(provider); }
    if (docusign_account_id !== undefined) { fields.push('docusign_account_id = ?'); values.push(docusign_account_id); }
    if (docusign_integration_key !== undefined) { fields.push('docusign_integration_key = ?'); values.push(docusign_integration_key); }
    if (docusign_secret !== undefined && docusign_secret !== '••••••••') { fields.push('docusign_secret = ?'); values.push(docusign_secret); }
    if (docusign_base_url !== undefined) { fields.push('docusign_base_url = ?'); values.push(docusign_base_url); }
    if (docusign_oauth_url !== undefined) { fields.push('docusign_oauth_url = ?'); values.push(docusign_oauth_url); }

    if (fields.length === 0) return res.json({ message: 'No changes' });

    fields.push('updated_at = NOW()');
    // Clear cached token when credentials change
    fields.push('docusign_access_token = NULL');
    fields.push('docusign_token_expires = NULL');

    await prepareRun(`UPDATE signing_settings SET ${fields.join(', ')} WHERE id = 1`, ...values);
    docusignService.clearSettingsCache();

    res.json({ message: 'Signing settings updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/signing-settings/test
router.post('/admin/signing-settings/test', async (req, res) => {
  try {
    const result = await docusignService.testConnection();
    res.json(result);
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SEND FOR SIGNING (DocuSign or Built-in)
// ═══════════════════════════════════════════════════════════════

// POST /api/retainer-agreements/:id/send-for-signing
router.post('/retainer-agreements/:id/send-for-signing', async (req, res) => {
  try {
    const agreement = await prepareGet('SELECT * FROM client_retainer_agreements WHERE id = ?', req.params.id);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', agreement.client_id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.email) return res.status(400).json({ error: 'Client has no email address on file' });

    const clientName = `${client.first_name} ${client.last_name}`;
    const settings = await prepareGet('SELECT provider FROM signing_settings WHERE id = 1');
    const provider = settings?.provider || 'builtin';

    if (provider === 'docusign') {
      // Determine webhook URL (use HOST header or env)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');
      const webhookUrl = process.env.DOCUSIGN_WEBHOOK_URL || `${protocol}://${host}/api/webhooks/docusign`;

      const result = await docusignService.createAndSendEnvelope(
        agreement.generated_html, clientName, client.email, agreement.id, webhookUrl
      );

      await prepareRun(
        `UPDATE client_retainer_agreements SET status = 'sent', signing_provider = 'docusign',
         docusign_envelope_id = ?, sent_for_signing_at = NOW() WHERE id = ?`,
        result.envelopeId, agreement.id
      );

      // Timeline event
      await prepareRun(
        `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
         VALUES (?, 'agreement_sent', 'Agreement sent for signing', ?, 'Admin')`,
        client.id, `Retainer agreement sent via DocuSign (Envelope: ${result.envelopeId})`
      );

      res.json({ message: `Agreement sent via DocuSign to ${client.email}`, provider: 'docusign', envelopeId: result.envelopeId });
    } else {
      // Built-in signing: create a signature request
      const { v4: uuidv4 } = require('uuid');
      const signToken = uuidv4();
      const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prepareRun(
        `INSERT INTO signatures (client_id, document_type, document_name, status, sign_token, token_expires, signing_provider, requested_by)
         VALUES (?, 'retainer_agreement', 'Retainer Agreement', 'pending', ?, ?, 'builtin', 'Admin')`,
        client.id, signToken, tokenExpires.toISOString()
      );

      await prepareRun(
        `UPDATE client_retainer_agreements SET status = 'sent', signing_provider = 'builtin',
         sent_for_signing_at = NOW() WHERE id = ?`,
        agreement.id
      );

      // Timeline event
      await prepareRun(
        `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
         VALUES (?, 'agreement_sent', 'Agreement sent for signing', 'Retainer agreement sent via built-in signing', 'Admin')`,
        client.id
      );

      res.json({ message: `Signing link created for ${client.email}`, provider: 'builtin', signToken });
    }
  } catch (err) {
    console.error('Error sending agreement for signing:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/service-fees/active — public (any authenticated user)
router.get('/service-fees/active', async (req, res) => {
  try {
    const rows = await prepareAll('SELECT * FROM service_fees WHERE is_active = true ORDER BY service_name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active service fees' });
  }
});

module.exports = router;
