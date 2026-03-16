const express = require('express');
const router = express.Router();
const { prepareGet, prepareRun } = require('../database');
const { validateSignToken, applySignatureToPDF, getSignaturePlacement, generateRetainerPDF } = require('../services/signatureService');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// GET /api/sign/:token — Validate token and return document info
router.get('/:token', async (req, res) => {
  try {
    const { valid, signature, error } = await validateSignToken(req.params.token);
    if (!valid) return res.status(400).json({ error });

    res.json({
      document_type: signature.document_type,
      document_name: signature.document_name,
      client_name: `${signature.first_name} ${signature.last_name}`,
      status: signature.status,
      has_pdf: !!(signature.signed_pdf_path || signature.filled_form_id),
    });
  } catch (err) {
    console.error('Error validating sign token:', err);
    res.status(500).json({ error: 'Failed to validate signature link' });
  }
});

// GET /api/sign/:token/preview — Download the document to preview before signing
router.get('/:token/preview', async (req, res) => {
  try {
    const { valid, signature, error } = await validateSignToken(req.params.token);
    if (!valid) return res.status(400).json({ error });

    let pdfPath = null;

    // Check filled_form_id first
    if (signature.filled_form_id) {
      const filled = await prepareGet('SELECT file_path FROM filled_forms WHERE id = ?', signature.filled_form_id);
      if (filled) pdfPath = filled.file_path;
    }

    // Check signed_pdf_path (generated retainer)
    if (!pdfPath && signature.signed_pdf_path) {
      pdfPath = signature.signed_pdf_path;
    }

    // Generate a retainer on the fly if nothing exists
    if (!pdfPath && signature.document_type === 'retainer_agreement') {
      const pdfBytes = await generateRetainerPDF(
        `${signature.first_name} ${signature.last_name}`,
        'Immigration Services'
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="retainer_agreement.pdf"');
      return res.send(Buffer.from(pdfBytes));
    }

    if (!pdfPath) {
      return res.status(404).json({ error: 'No document available for preview' });
    }

    const absPath = path.isAbsolute(pdfPath) ? pdfPath : path.join(__dirname, '..', pdfPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${signature.document_name || 'document'}.pdf"`);
    res.sendFile(absPath);
  } catch (err) {
    console.error('Error previewing document:', err);
    res.status(500).json({ error: 'Failed to load document preview' });
  }
});

// POST /api/sign/:token — Submit signature
router.post('/:token', async (req, res) => {
  try {
    const { valid, signature, error } = await validateSignToken(req.params.token);
    if (!valid) return res.status(400).json({ error });

    const { signature_data } = req.body;
    if (!signature_data) return res.status(400).json({ error: 'Signature data required' });

    // Decode base64 PNG
    const base64Data = signature_data.replace(/^data:image\/png;base64,/, '');
    const signatureBuffer = Buffer.from(base64Data, 'base64');

    // Save signature image
    const sigDir = path.join(__dirname, '..', 'uploads', 'signatures');
    if (!fs.existsSync(sigDir)) fs.mkdirSync(sigDir, { recursive: true });
    const sigFilename = `sig_${signature.id}_${uuidv4().slice(0, 8)}.png`;
    const sigPath = path.join('uploads', 'signatures', sigFilename);
    fs.writeFileSync(path.join(__dirname, '..', sigPath), signatureBuffer);

    // Get or generate the document PDF
    let pdfPath = null;
    if (signature.filled_form_id) {
      const filled = await prepareGet('SELECT file_path FROM filled_forms WHERE id = ?', signature.filled_form_id);
      if (filled) pdfPath = filled.file_path;
    }
    if (!pdfPath && signature.signed_pdf_path) {
      pdfPath = signature.signed_pdf_path;
    }

    let signedPdfPath = null;

    if (pdfPath) {
      // Apply signature to existing PDF
      const placement = getSignaturePlacement(signature.document_type);
      const outFilename = `signed_${signature.id}_${uuidv4().slice(0, 8)}.pdf`;
      const outPath = path.join('uploads', 'signatures', outFilename);
      const absOutPath = path.join(__dirname, '..', outPath);

      await applySignatureToPDF(signatureBuffer, pdfPath, absOutPath, placement);
      signedPdfPath = outPath;
    } else if (signature.document_type === 'retainer_agreement') {
      // Generate retainer + apply signature
      const pdfBytes = await generateRetainerPDF(
        `${signature.first_name} ${signature.last_name}`,
        'Immigration Services'
      );
      const placement = getSignaturePlacement('retainer_agreement');
      const outFilename = `signed_retainer_${signature.id}_${uuidv4().slice(0, 8)}.pdf`;
      const outPath = path.join('uploads', 'signatures', outFilename);
      const absOutPath = path.join(__dirname, '..', outPath);

      await applySignatureToPDF(signatureBuffer, Buffer.from(pdfBytes), absOutPath, placement);
      signedPdfPath = outPath;
    }

    // Update signature record
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    await prepareRun(
      `UPDATE signatures SET
        status = 'signed', signed_at = NOW(), signature_image = ?,
        signed_pdf_path = COALESCE(?, signed_pdf_path),
        ip_address = ?, user_agent = ?
       WHERE id = ?`,
      sigPath, signedPdfPath, ipAddress, userAgent.substring(0, 500), signature.id
    );

    // Timeline event
    await prepareRun(
      `INSERT INTO client_timeline (client_id, event_type, title, description, created_by)
       VALUES (?, 'document_signed', 'Document signed', ?, 'Client')`,
      signature.client_id,
      `${signature.document_name} signed electronically`
    );

    // If retainer signed, advance pipeline stage
    if (signature.document_type === 'retainer_agreement') {
      await prepareRun(
        "UPDATE clients SET pipeline_stage = 'retainer_signed', updated_at = NOW() WHERE id = ? AND pipeline_stage IN ('lead', 'consultation')",
        signature.client_id
      );
    }

    res.json({
      success: true,
      signed_pdf_path: signedPdfPath,
      download_url: signedPdfPath ? `/uploads/${signedPdfPath}` : null,
    });
  } catch (err) {
    console.error('Error processing signature:', err);
    res.status(500).json({ error: `Failed to process signature: ${err.message}` });
  }
});

// GET /api/sign/download/:sigId — Download signed PDF (public, but needs valid signed status)
router.get('/download/:sigId', async (req, res) => {
  try {
    const sig = await prepareGet(
      "SELECT signed_pdf_path, document_name FROM signatures WHERE id = ? AND status = 'signed'",
      req.params.sigId
    );
    if (!sig || !sig.signed_pdf_path) return res.status(404).json({ error: 'Signed document not found' });

    const absPath = path.isAbsolute(sig.signed_pdf_path)
      ? sig.signed_pdf_path
      : path.join(__dirname, '..', sig.signed_pdf_path);

    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'File not found on disk' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="signed_${sig.document_name || 'document'}.pdf"`);
    res.sendFile(absPath);
  } catch (err) {
    console.error('Error downloading signed PDF:', err);
    res.status(500).json({ error: 'Failed to download' });
  }
});

module.exports = router;
