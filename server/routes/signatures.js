const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { createSignatureRequest, generateRetainerPDF } = require('../services/signatureService');
const { sendSignatureRequestEmail } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// GET /api/clients/:clientId/signatures — List signature requests
router.get('/clients/:clientId/signatures', async (req, res) => {
  try {
    const sigs = await prepareAll(
      `SELECT id, document_type, document_name, status, signed_at, sign_token, token_expires, created_at
       FROM signatures WHERE client_id = ? ORDER BY created_at DESC`,
      req.params.clientId
    );
    res.json(sigs);
  } catch (err) {
    console.error('Error fetching signatures:', err);
    res.status(500).json({ error: 'Failed to fetch signatures' });
  }
});

// POST /api/clients/:clientId/signatures — Create a signature request
router.post('/clients/:clientId/signatures', async (req, res) => {
  try {
    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', req.params.clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { document_type, document_name, filled_form_id } = req.body;
    if (!document_type) return res.status(400).json({ error: 'document_type is required' });

    const name = document_name || (document_type === 'retainer_agreement' ? 'Retainer Agreement' : document_type === 'imm_5476' ? 'IMM 5476 - Use of Representative' : 'Document');

    // If retainer and no filled_form_id, generate a retainer PDF
    let pdfPath = null;
    if (document_type === 'retainer_agreement' && !filled_form_id) {
      const pdfBytes = await generateRetainerPDF(
        `${client.first_name} ${client.last_name}`,
        client.visa_type || 'Immigration Services'
      );
      const filename = `retainer_${client.id}_${uuidv4().slice(0, 8)}.pdf`;
      const outDir = path.join(__dirname, '..', 'uploads', 'signatures');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      pdfPath = path.join('uploads', 'signatures', filename);
      fs.writeFileSync(path.join(__dirname, '..', pdfPath), pdfBytes);
    }

    const result = await createSignatureRequest(
      client.id, document_type, name, filled_form_id || null
    );

    // Store the PDF path if generated
    if (pdfPath) {
      await prepareRun(
        'UPDATE signatures SET signed_pdf_path = ? WHERE sign_token = ?',
        pdfPath, result.sign_token
      );
    }

    // Timeline event
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'signature_requested', 'Signature requested', ?, 'Admin')`,
      client.id, `${name} - awaiting signature`
    );

    res.json({
      id: result.id,
      sign_token: result.sign_token,
      token_expires: result.token_expires,
      sign_url: `/sign/${result.sign_token}`,
      document_name: name,
    });
  } catch (err) {
    console.error('Error creating signature request:', err);
    res.status(500).json({ error: 'Failed to create signature request' });
  }
});

// POST /api/clients/:clientId/signatures/:sigId/send — Send signature email
router.post('/clients/:clientId/signatures/:sigId/send', async (req, res) => {
  try {
    const client = await prepareGet('SELECT * FROM clients WHERE id = ?', req.params.clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.email) return res.status(400).json({ error: 'Client has no email address' });

    const sig = await prepareGet('SELECT * FROM signatures WHERE id = ? AND client_id = ?', req.params.sigId, req.params.clientId);
    if (!sig) return res.status(404).json({ error: 'Signature request not found' });

    await sendSignatureRequestEmail(
      client.email,
      `${client.first_name} ${client.last_name}`,
      sig.sign_token,
      sig.document_name
    );

    await prepareRun("UPDATE signatures SET status = 'sent' WHERE id = ?", sig.id);

    // Timeline event
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'signature_sent', 'Signature request sent', ?, 'Admin')`,
      client.id, `Email sent to ${client.email} for ${sig.document_name}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error sending signature email:', err);
    res.status(500).json({ error: 'Failed to send signature email' });
  }
});

// DELETE /api/signatures/:id — Delete/cancel a signature request
router.delete('/signatures/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM signatures WHERE id = ?', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting signature:', err);
    res.status(500).json({ error: 'Failed to delete signature' });
  }
});

module.exports = router;
