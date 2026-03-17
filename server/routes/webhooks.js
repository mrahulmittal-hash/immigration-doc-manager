const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');
const docusignService = require('../services/docusignService');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// DOCUSIGN CONNECT WEBHOOK
// ═══════════════════════════════════════════════════════════════

// POST /api/webhooks/docusign — DocuSign envelope status callback (PUBLIC)
router.post('/docusign', async (req, res) => {
  try {
    const payload = req.body;

    // Validate HMAC if available
    const hmacHeader = req.headers['x-docusign-signature-1'];
    if (hmacHeader) {
      const settings = await docusignService.getSettings();
      const valid = docusignService.validateWebhookPayload(
        JSON.stringify(payload), hmacHeader, settings.docusign_integration_key
      );
      if (!valid) {
        console.warn('DocuSign webhook HMAC validation failed');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Extract envelope data
    // DocuSign Connect sends different formats; handle both XML-based and JSON
    const envelopeId = payload.envelopeId || payload.data?.envelopeId || payload.EnvelopeStatus?.EnvelopeID;
    const envelopeStatus = payload.status || payload.data?.envelopeSummary?.status || payload.EnvelopeStatus?.Status;

    if (!envelopeId) {
      console.warn('DocuSign webhook: missing envelopeId');
      return res.status(200).json({ message: 'No envelopeId found, ignored' });
    }

    console.log(`DocuSign webhook: envelope=${envelopeId}, status=${envelopeStatus}`);

    if (envelopeStatus === 'completed') {
      // Find the agreement by envelope ID
      const agreement = await prepareGet(
        'SELECT * FROM client_retainer_agreements WHERE docusign_envelope_id = ?', envelopeId
      );

      if (!agreement) {
        console.warn(`DocuSign webhook: no agreement found for envelope ${envelopeId}`);
        return res.status(200).json({ message: 'Envelope not found, ignored' });
      }

      // Update agreement status to signed
      await prepareRun(
        `UPDATE client_retainer_agreements SET status = 'signed', signed_at = NOW() WHERE id = ?`,
        agreement.id
      );

      // Download and save the signed PDF
      try {
        const pdfBuffer = await docusignService.getSignedDocument(envelopeId);
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'signatures');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const pdfPath = path.join(uploadsDir, `retainer_${agreement.client_id}_${agreement.id}_signed.pdf`);
        fs.writeFileSync(pdfPath, pdfBuffer);
        console.log(`Signed PDF saved: ${pdfPath}`);
      } catch (pdfErr) {
        console.error('Failed to download signed PDF from DocuSign:', pdfErr.message);
      }

      // Advance pipeline stage to retainer_signed
      const client = await prepareGet('SELECT pipeline_stage FROM clients WHERE id = ?', agreement.client_id);
      if (client) {
        const stageOrder = ['lead', 'consultation', 'retainer_signed', 'in_progress', 'submitted', 'approved'];
        const currentIdx = stageOrder.indexOf(client.pipeline_stage || 'lead');
        const targetIdx = stageOrder.indexOf('retainer_signed');
        if (currentIdx < targetIdx) {
          await prepareRun('UPDATE clients SET pipeline_stage = ? WHERE id = ?', 'retainer_signed', agreement.client_id);
        }
      }

      // Update any matching signature records
      await prepareRun(
        `UPDATE signatures SET status = 'signed', signed_at = NOW()
         WHERE client_id = ? AND document_type = 'retainer_agreement' AND docusign_envelope_id = ?`,
        agreement.client_id, envelopeId
      );

      // Timeline event
      await prepareRun(
        `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
         VALUES (?, 'document_signed', 'Retainer agreement signed', ?, 'DocuSign')`,
        agreement.client_id, `Agreement #${agreement.id} signed via DocuSign`
      );

      console.log(`Agreement #${agreement.id} marked as signed via DocuSign`);
    } else if (envelopeStatus === 'declined' || envelopeStatus === 'voided') {
      // Handle declined/voided envelopes
      const agreement = await prepareGet(
        'SELECT * FROM client_retainer_agreements WHERE docusign_envelope_id = ?', envelopeId
      );
      if (agreement) {
        await prepareRun(
          `UPDATE client_retainer_agreements SET status = 'draft' WHERE id = ?`,
          agreement.id
        );
        await prepareRun(
          `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
           VALUES (?, 'agreement_declined', 'Agreement ${envelopeStatus}', ?, 'DocuSign')`,
          agreement.client_id, `Agreement #${agreement.id} was ${envelopeStatus} via DocuSign`
        );
      }
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ message: 'Webhook processed' });
  } catch (err) {
    console.error('DocuSign webhook error:', err);
    // Return 200 anyway to prevent DocuSign from retrying
    res.status(200).json({ message: 'Webhook processed with errors' });
  }
});

module.exports = router;
