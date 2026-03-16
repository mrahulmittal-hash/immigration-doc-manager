const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { prepareGet, prepareRun } = require('../database');

// Create a new signature request
async function createSignatureRequest(clientId, documentType, documentName, filledFormId = null, requestedBy = 'Admin') {
  const signToken = uuidv4();
  const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const result = await prepareRun(
    `INSERT INTO signatures (client_id, document_type, document_name, sign_token, token_expires, filled_form_id, requested_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    clientId, documentType, documentName, signToken, tokenExpires.toISOString(), filledFormId, requestedBy
  );

  return {
    id: result.lastID || result.id,
    sign_token: signToken,
    token_expires: tokenExpires,
  };
}

// Validate a signing token
async function validateSignToken(token) {
  const sig = await prepareGet(
    `SELECT s.*, c.first_name, c.last_name, c.email
     FROM signatures s
     JOIN clients c ON c.id = s.client_id
     WHERE s.sign_token = ?`,
    token
  );

  if (!sig) return { valid: false, error: 'Invalid signature link' };
  if (sig.status === 'signed') return { valid: false, error: 'This document has already been signed' };
  if (new Date(sig.token_expires) < new Date()) return { valid: false, error: 'This signature link has expired' };

  return { valid: true, signature: sig };
}

// Apply a signature image (PNG buffer) to a PDF
async function applySignatureToPDF(signatureBuffer, pdfPath, outputPath, options = {}) {
  const { page: pageNum = -1, x = 72, y = 100, width = 200, height = 60 } = options;

  let pdfBytes;
  if (Buffer.isBuffer(pdfPath)) {
    pdfBytes = pdfPath;
  } else {
    const absPath = path.isAbsolute(pdfPath) ? pdfPath : path.join(__dirname, '..', pdfPath);
    pdfBytes = fs.readFileSync(absPath);
  }

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pngImage = await pdfDoc.embedPng(signatureBuffer);

  // Place on specified page (default: last page)
  const pageIndex = pageNum === -1 ? pdfDoc.getPageCount() - 1 : pageNum;
  const pdfPage = pdfDoc.getPage(pageIndex);

  pdfPage.drawImage(pngImage, {
    x,
    y,
    width,
    height,
  });

  const signedPdfBytes = await pdfDoc.save();

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, signedPdfBytes);
  return outputPath;
}

// Generate a simple retainer agreement PDF
async function generateRetainerPDF(clientName, serviceName) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont('Helvetica');
  const boldFont = await pdfDoc.embedFont('Helvetica-Bold');

  let yPos = height - 72;
  const leftMargin = 72;

  // Title
  page.drawText('RETAINER AGREEMENT', { x: leftMargin, y: yPos, size: 18, font: boldFont });
  yPos -= 40;

  page.drawText('Immigration Consulting Services', { x: leftMargin, y: yPos, size: 14, font });
  yPos -= 40;

  // Client info
  page.drawText(`Client: ${clientName}`, { x: leftMargin, y: yPos, size: 12, font });
  yPos -= 24;
  page.drawText(`Service: ${serviceName}`, { x: leftMargin, y: yPos, size: 12, font });
  yPos -= 24;
  page.drawText(`Date: ${new Date().toLocaleDateString('en-CA')}`, { x: leftMargin, y: yPos, size: 12, font });
  yPos -= 40;

  // Terms
  const terms = [
    '1. The Consultant agrees to provide immigration consulting services as described above.',
    '2. The Client agrees to provide all necessary documents truthfully and in a timely manner.',
    '3. The Client acknowledges that the Consultant cannot guarantee the outcome of any application.',
    '4. Fees are as agreed upon and are subject to the payment schedule outlined separately.',
    '5. Either party may terminate this agreement with 30 days written notice.',
    '6. The Consultant is a Regulated Canadian Immigration Consultant (RCIC) in good standing.',
    '7. All information provided will be kept confidential per CICC regulations.',
  ];

  for (const term of terms) {
    const words = term.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      if (font.widthOfTextAtSize(testLine, 11) > width - 144) {
        page.drawText(line, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 18;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: leftMargin, y: yPos, size: 11, font });
      yPos -= 28;
    }
  }

  // Signature area
  yPos -= 30;
  page.drawText('Client Signature:', { x: leftMargin, y: yPos, size: 12, font: boldFont });
  yPos -= 20;
  page.drawLine({ start: { x: leftMargin, y: yPos }, end: { x: leftMargin + 250, y: yPos }, thickness: 1 });
  yPos -= 30;

  page.drawText('Consultant Signature:', { x: leftMargin, y: yPos, size: 12, font: boldFont });
  yPos -= 20;
  page.drawLine({ start: { x: leftMargin, y: yPos }, end: { x: leftMargin + 250, y: yPos }, thickness: 1 });

  return await pdfDoc.save();
}

// Signature placement coordinates for known document types
const SIGNATURE_PLACEMENTS = {
  retainer_agreement: { page: -1, x: 72, y: 280, width: 200, height: 60 },
  imm_5476: { page: -1, x: 72, y: 150, width: 180, height: 50 },
  custom: { page: -1, x: 72, y: 100, width: 200, height: 60 },
};

function getSignaturePlacement(documentType) {
  return SIGNATURE_PLACEMENTS[documentType] || SIGNATURE_PLACEMENTS.custom;
}

module.exports = {
  createSignatureRequest,
  validateSignToken,
  applySignatureToPDF,
  generateRetainerPDF,
  getSignaturePlacement,
};
