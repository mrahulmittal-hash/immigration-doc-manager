const { getDb, prepareGet, prepareRun, prepareAll } = require('../database');

// Ensure a trust account exists for a client
async function ensureTrustAccount(clientId) {
  const existing = await prepareGet('SELECT id FROM trust_accounts WHERE client_id = ?', clientId);
  if (!existing) {
    await prepareRun(
      'INSERT INTO trust_accounts (client_id, balance) VALUES (?, 0.00)',
      clientId
    );
  }
}

// Record a transaction atomically (using PostgreSQL transaction)
async function recordTransaction(pool, clientId, type, amount, description, meta = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert transaction
    const txResult = await client.query(
      `INSERT INTO transactions (client_id, invoice_id, type, amount, description, reference_number, pipeline_stage, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [clientId, meta.invoice_id || null, type, amount, description, meta.reference_number || null, meta.pipeline_stage || null, meta.created_by || 'Admin']
    );
    const transactionId = txResult.rows[0].id;

    // Update trust account balance
    if (type === 'deposit_to_trust') {
      await client.query(
        'UPDATE trust_accounts SET balance = balance + $1, updated_at = NOW() WHERE client_id = $2',
        [amount, clientId]
      );
    } else if (type === 'trust_to_operating') {
      // Verify sufficient balance
      const trustResult = await client.query('SELECT balance FROM trust_accounts WHERE client_id = $1', [clientId]);
      const currentBalance = parseFloat(trustResult.rows[0]?.balance || 0);
      if (currentBalance < amount) {
        await client.query('ROLLBACK');
        throw new Error(`Insufficient trust balance. Current: $${currentBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`);
      }
      await client.query(
        'UPDATE trust_accounts SET balance = balance - $1, updated_at = NOW() WHERE client_id = $2',
        [amount, clientId]
      );
      // Update operating account (single row)
      await client.query(
        'UPDATE operating_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = 1',
        [amount]
      );
    } else if (type === 'refund') {
      const trustResult = await client.query('SELECT balance FROM trust_accounts WHERE client_id = $1', [clientId]);
      const currentBalance = parseFloat(trustResult.rows[0]?.balance || 0);
      if (currentBalance < amount) {
        await client.query('ROLLBACK');
        throw new Error(`Insufficient trust balance for refund. Current: $${currentBalance.toFixed(2)}`);
      }
      await client.query(
        'UPDATE trust_accounts SET balance = balance - $1, updated_at = NOW() WHERE client_id = $2',
        [amount, clientId]
      );
    }

    await client.query('COMMIT');
    return transactionId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Generate sequential invoice number
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const last = await prepareGet(
    "SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1",
    `INV-${year}-%`
  );

  let seq = 1;
  if (last) {
    const parts = last.invoice_number.split('-');
    seq = parseInt(parts[2] || '0') + 1;
  }

  return `INV-${year}-${String(seq).padStart(4, '0')}`;
}

// Get financial summary for a client
async function getClientFinancialSummary(clientId) {
  const trust = await prepareGet('SELECT balance FROM trust_accounts WHERE client_id = ?', clientId);
  const totalDeposited = await prepareGet(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE client_id = ? AND type = 'deposit_to_trust'",
    clientId
  );
  const totalReleased = await prepareGet(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE client_id = ? AND type = 'trust_to_operating'",
    clientId
  );
  const totalRefunded = await prepareGet(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE client_id = ? AND type = 'refund'",
    clientId
  );
  const outstandingInvoices = await prepareGet(
    "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE client_id = ? AND status IN ('sent', 'overdue')",
    clientId
  );

  return {
    trust_balance: parseFloat(trust?.balance || 0),
    total_deposited: parseFloat(totalDeposited?.total || 0),
    total_released: parseFloat(totalReleased?.total || 0),
    total_refunded: parseFloat(totalRefunded?.total || 0),
    outstanding_invoices: parseFloat(outstandingInvoices?.total || 0),
  };
}

// Generate receipt number
async function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const last = await prepareGet(
    "SELECT receipt_number FROM receipts WHERE receipt_number LIKE ? ORDER BY id DESC LIMIT 1",
    `REC-${year}-%`
  );
  let seq = 1;
  if (last) {
    const parts = last.receipt_number.split('-');
    seq = parseInt(parts[2] || '0') + 1;
  }
  return `REC-${year}-${String(seq).padStart(4, '0')}`;
}

// Generate invoice PDF using pdf-lib
async function generateInvoicePDF(invoiceId) {
  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
  const invoice = await prepareGet('SELECT i.*, c.first_name, c.last_name, c.email, c.phone, c.nationality FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id = ?', invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const firm = await prepareGet('SELECT * FROM firm_profile WHERE id = 1');
  const lineItems = typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items || '[]') : (invoice.line_items || []);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let y = height - 50;

  // Header - Firm info
  page.drawText(firm?.business_name || 'PropAgent Immigration', { x: 50, y, font: fontBold, size: 18, color: rgb(0.06, 0.46, 0.43) });
  y -= 16;
  if (firm?.rcic_name) { page.drawText(`RCIC: ${firm.rcic_name} (${firm.rcic_license || ''})`, { x: 50, y, font, size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
  if (firm?.address) { page.drawText(`${firm.address}, ${firm.city || ''} ${firm.province || ''} ${firm.postal_code || ''}`, { x: 50, y, font, size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
  if (firm?.phone) { page.drawText(`Phone: ${firm.phone} | Email: ${firm.email || ''}`, { x: 50, y, font, size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12; }

  // INVOICE title
  y -= 20;
  page.drawText('INVOICE', { x: 50, y, font: fontBold, size: 24, color: rgb(0.07, 0.07, 0.13) });
  page.drawText(invoice.invoice_number, { x: 400, y, font: fontBold, size: 14, color: rgb(0.06, 0.46, 0.43) });
  y -= 16;
  page.drawText(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, { x: 400, y, font, size: 10, color: rgb(0.3, 0.3, 0.3) });
  y -= 12;
  if (invoice.due_date) { page.drawText(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, { x: 400, y, font, size: 10, color: rgb(0.3, 0.3, 0.3) }); y -= 12; }
  page.drawText(`Status: ${invoice.status}`, { x: 400, y, font, size: 10, color: rgb(0.3, 0.3, 0.3) });

  // Bill To
  y -= 10;
  page.drawRectangle({ x: 50, y: y - 50, width: 250, height: 50, color: rgb(0.96, 0.97, 0.98) });
  page.drawText('BILL TO:', { x: 60, y: y - 15, font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`${invoice.first_name} ${invoice.last_name}`, { x: 60, y: y - 28, font: fontBold, size: 11, color: rgb(0.07, 0.07, 0.13) });
  if (invoice.email) page.drawText(invoice.email, { x: 60, y: y - 40, font, size: 9, color: rgb(0.3, 0.3, 0.3) });

  // Line items table
  y -= 80;
  // Header row
  page.drawRectangle({ x: 50, y: y - 18, width: 495, height: 20, color: rgb(0.06, 0.46, 0.43) });
  page.drawText('Description', { x: 60, y: y - 13, font: fontBold, size: 10, color: rgb(1, 1, 1) });
  page.drawText('Qty', { x: 370, y: y - 13, font: fontBold, size: 10, color: rgb(1, 1, 1) });
  page.drawText('Amount', { x: 420, y: y - 13, font: fontBold, size: 10, color: rgb(1, 1, 1) });
  page.drawText('Total', { x: 490, y: y - 13, font: fontBold, size: 10, color: rgb(1, 1, 1) });
  y -= 22;

  let subtotal = 0;
  if (lineItems.length > 0) {
    for (const item of lineItems) {
      const qty = parseInt(item.quantity) || 1;
      const amt = parseFloat(item.amount) || 0;
      const lineTotal = qty * amt;
      subtotal += lineTotal;

      page.drawText(String(item.description || '').substring(0, 50), { x: 60, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(String(qty), { x: 375, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`$${amt.toFixed(2)}`, { x: 420, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`$${lineTotal.toFixed(2)}`, { x: 485, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
      page.drawLine({ start: { x: 50, y: y - 18 }, end: { x: 545, y: y - 18 }, color: rgb(0.9, 0.9, 0.9), thickness: 0.5 });
      y -= 22;
    }
  } else {
    subtotal = parseFloat(invoice.amount) || 0;
    page.drawText(invoice.description || 'Professional services', { x: 60, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('1', { x: 375, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`$${subtotal.toFixed(2)}`, { x: 420, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`$${subtotal.toFixed(2)}`, { x: 485, y: y - 12, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
    y -= 22;
  }

  // Totals
  y -= 10;
  page.drawLine({ start: { x: 380, y }, end: { x: 545, y }, color: rgb(0.06, 0.46, 0.43), thickness: 1 });
  y -= 16;
  page.drawText('Subtotal:', { x: 390, y, font, size: 11, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: 485, y, font: fontBold, size: 11, color: rgb(0.1, 0.1, 0.1) });
  y -= 16;
  const gst = subtotal * 0.05;
  page.drawText('GST (5%):', { x: 390, y, font, size: 11, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`$${gst.toFixed(2)}`, { x: 485, y, font, size: 11, color: rgb(0.1, 0.1, 0.1) });
  y -= 20;
  page.drawRectangle({ x: 380, y: y - 4, width: 165, height: 22, color: rgb(0.06, 0.46, 0.43) });
  page.drawText('TOTAL:', { x: 390, y, font: fontBold, size: 12, color: rgb(1, 1, 1) });
  page.drawText(`$${(subtotal + gst).toFixed(2)}`, { x: 480, y, font: fontBold, size: 12, color: rgb(1, 1, 1) });

  // Footer
  y = 60;
  page.drawText('Thank you for choosing our immigration services.', { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Payment is due upon receipt unless otherwise stated.', { x: 50, y: y - 14, font, size: 9, color: rgb(0.5, 0.5, 0.5) });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

// Generate receipt PDF
async function generateReceiptPDF(paymentId) {
  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
  const payment = await prepareGet(
    `SELECT p.*, c.first_name, c.last_name, c.email FROM payments p
     JOIN clients c ON c.id = p.client_id WHERE p.id = ?`, paymentId
  );
  if (!payment) throw new Error('Payment not found');

  const firm = await prepareGet('SELECT * FROM firm_profile WHERE id = 1');

  // Check if receipt exists
  let receipt = await prepareGet('SELECT * FROM receipts WHERE payment_id = ?', paymentId);
  if (!receipt) {
    const receiptNumber = await generateReceiptNumber();
    await prepareRun(
      'INSERT INTO receipts (payment_id, client_id, receipt_number) VALUES (?, ?, ?)',
      paymentId, payment.client_id, receiptNumber
    );
    receipt = await prepareGet('SELECT * FROM receipts WHERE payment_id = ?', paymentId);
  }

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 420]); // Half A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 380;

  // Header
  page.drawText(firm?.business_name || 'PropAgent Immigration', { x: 50, y, font: fontBold, size: 16, color: rgb(0.06, 0.46, 0.43) });
  page.drawText('PAYMENT RECEIPT', { x: 380, y, font: fontBold, size: 14, color: rgb(0.07, 0.07, 0.13) });
  y -= 16;
  if (firm?.phone) page.drawText(`${firm.phone} | ${firm.email || ''}`, { x: 50, y, font, size: 8, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(receipt.receipt_number, { x: 410, y, font: fontBold, size: 11, color: rgb(0.06, 0.46, 0.43) });
  y -= 30;

  // Details
  page.drawText('Received from:', { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`${payment.first_name} ${payment.last_name}`, { x: 150, y, font: fontBold, size: 11, color: rgb(0.1, 0.1, 0.1) });
  y -= 18;
  page.drawText('Date:', { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A', { x: 150, y, font, size: 11, color: rgb(0.1, 0.1, 0.1) });
  y -= 18;
  page.drawText('Method:', { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(payment.payment_method || 'N/A', { x: 150, y, font, size: 11, color: rgb(0.1, 0.1, 0.1) });
  y -= 18;
  if (payment.reference_number) {
    page.drawText('Reference:', { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(payment.reference_number, { x: 150, y, font, size: 11, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
  }
  y -= 10;

  // Amount box
  page.drawRectangle({ x: 50, y: y - 40, width: 495, height: 44, color: rgb(0.96, 0.97, 0.98), borderColor: rgb(0.06, 0.46, 0.43), borderWidth: 1 });
  page.drawText('AMOUNT RECEIVED:', { x: 70, y: y - 18, font: fontBold, size: 12, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`$${parseFloat(payment.amount).toFixed(2)}`, { x: 380, y: y - 18, font: fontBold, size: 20, color: rgb(0.06, 0.46, 0.43) });
  y -= 60;

  if (payment.notes) {
    page.drawText('Notes:', { x: 50, y, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(payment.notes, { x: 100, y, font, size: 9, color: rgb(0.3, 0.3, 0.3) });
  }

  // Footer
  page.drawText('This receipt confirms payment received. Thank you.', { x: 50, y: 30, font, size: 8, color: rgb(0.5, 0.5, 0.5) });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  ensureTrustAccount,
  recordTransaction,
  generateInvoiceNumber,
  generateReceiptNumber,
  generateInvoicePDF,
  generateReceiptPDF,
  getClientFinancialSummary,
};
