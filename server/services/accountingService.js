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

module.exports = {
  ensureTrustAccount,
  recordTransaction,
  generateInvoiceNumber,
  getClientFinancialSummary,
};
