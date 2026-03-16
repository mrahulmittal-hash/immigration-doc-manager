import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { DollarSign, Clock, ClipboardList, CheckCircle, X, CreditCard } from 'lucide-react';

const STATUS_COLORS = {
  paid:    '#10b981',
  partial: '#f59e0b',
  pending: '#6b7280',
  overdue: '#ef4444',
};

const STATUS_BADGE = {
  paid:    'badge-success',
  partial: 'badge-warning',
  pending: 'badge-gray',
  overdue: 'badge-danger',
};

export default function Retainers() {
  const [tab, setTab] = useState('retainers'); // 'retainers' | 'invoices'

  // ── Client Retainers state ─────────────────────────────
  const [retainers, setRetainers] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total_collected: 0, outstanding: 0, total_billed: 0, paid_count: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // New retainer modal
  const [showNew, setShowNew] = useState(false);
  const [newR, setNewR] = useState({ client_id: '', service_type: '', retainer_fee: '', due_date: '', signed_date: '', notes: '' });
  const [creatingRetainer, setCreatingRetainer] = useState(false);

  // Record payment modal
  const [showPayment, setShowPayment] = useState(null); // retainer object or null
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'e-Transfer', payment_date: '', reference_number: '' });
  const [recordingPayment, setRecordingPayment] = useState(false);

  // ── Employer Invoices state ────────────────────────────
  const [employers, setEmployers] = useState([]);
  const [invoices, setInvoices] = useState([]); // all employer fees flattened
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Add invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ employer_id: '', description: '', amount: '', due_date: '' });
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // ── Fetching ───────────────────────────────────────────
  const fetchRetainers = useCallback(async () => {
    try {
      const statusParam = filter === 'all' ? undefined : filter;
      const [retainerData, clientData, statsData] = await Promise.all([
        api.getRetainers(statusParam),
        api.getClients(),
        api.getRetainerStats().catch(() => ({})),
      ]);
      setRetainers(retainerData);
      setClients(clientData);
      setStats({
        total_collected: statsData.total_collected || 0,
        outstanding: statsData.outstanding || 0,
        total_billed: statsData.total_billed || 0,
        paid_count: statsData.paid_count || 0,
      });
    } catch (err) {
      console.error('Failed to load retainers:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const empData = await api.getEmployers();
      setEmployers(empData);
      // Fetch fees for each employer
      const allFees = await Promise.all(
        empData.map(async (emp) => {
          try {
            const fees = await api.getEmployerFees(emp.id);
            return fees.map(f => ({ ...f, employer_name: emp.company_name, employer_id: emp.id }));
          } catch {
            return [];
          }
        })
      );
      setInvoices(allFees.flat());
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => { fetchRetainers(); }, [fetchRetainers]);
  useEffect(() => { if (tab === 'invoices') fetchInvoices(); }, [tab, fetchInvoices]);

  // ── Helpers ────────────────────────────────────────────
  function fmt(n) { return `$${(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }

  // ── Create retainer ────────────────────────────────────
  const handleCreateRetainer = async () => {
    if (!newR.client_id || !newR.retainer_fee) return;
    setCreatingRetainer(true);
    try {
      await api.createRetainer(parseInt(newR.client_id), {
        service_type: newR.service_type,
        retainer_fee: parseFloat(newR.retainer_fee),
        due_date: newR.due_date || null,
        signed_date: newR.signed_date || null,
        notes: newR.notes,
      });
      setShowNew(false);
      setNewR({ client_id: '', service_type: '', retainer_fee: '', due_date: '', signed_date: '', notes: '' });
      fetchRetainers();
    } catch (err) {
      console.error('Failed to create retainer:', err);
    } finally {
      setCreatingRetainer(false);
    }
  };

  // ── Record payment ─────────────────────────────────────
  const handleRecordPayment = async () => {
    if (!showPayment || !payForm.amount) return;
    setRecordingPayment(true);
    try {
      await api.recordPayment(showPayment.id, {
        amount: parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        payment_date: payForm.payment_date || new Date().toISOString().slice(0, 10),
        reference_number: payForm.reference_number,
      });
      setShowPayment(null);
      setPayForm({ amount: '', payment_method: 'e-Transfer', payment_date: '', reference_number: '' });
      fetchRetainers();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setRecordingPayment(false);
    }
  };

  // ── Create invoice (employer fee) ──────────────────────
  const handleCreateInvoice = async () => {
    if (!invoiceForm.employer_id || !invoiceForm.amount) return;
    setCreatingInvoice(true);
    try {
      await api.createEmployerFee(parseInt(invoiceForm.employer_id), {
        description: invoiceForm.description,
        amount: parseFloat(invoiceForm.amount),
        due_date: invoiceForm.due_date || null,
      });
      setShowInvoice(false);
      setInvoiceForm({ employer_id: '', description: '', amount: '', due_date: '' });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to create invoice:', err);
    } finally {
      setCreatingInvoice(false);
    }
  };

  // ── Mark invoice paid ──────────────────────────────────
  const handleMarkPaid = async (fee) => {
    try {
      await api.updateEmployerFee(fee.id, {
        status: 'paid',
        paid_date: new Date().toISOString().slice(0, 10),
      });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to mark paid:', err);
    }
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Retainers &amp; Invoices</div>
          <div className="page-subtitle">Track client payments, outstanding balances, and employer invoices</div>
        </div>
        {tab === 'retainers' ? (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Retainer</button>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowInvoice(true)}>+ Add Invoice</button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'retainers', label: 'Client Retainers' },
          { key: 'invoices',  label: 'Employer Invoices' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={22} /></div>
          <div className="stat-value">{fmt(stats.total_collected)}</div>
          <div className="stat-label">Total Collected</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={22} /></div>
          <div className="stat-value">{fmt(stats.outstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ClipboardList size={22} /></div>
          <div className="stat-value">{fmt(stats.total_billed)}</div>
          <div className="stat-label">Total Billed</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={22} /></div>
          <div className="stat-value">{stats.paid_count || 0}</div>
          <div className="stat-label">Paid in Full</div>
        </div>
      </div>

      {/* ═══════════════ CLIENT RETAINERS TAB ═══════════════ */}
      {tab === 'retainers' && (
        <>
          {/* Filters */}
          <div className="filter-bar">
            {['all', 'paid', 'partial', 'pending', 'overdue'].map(f => (
              <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Service</th>
                    <th>Retainer Fee</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Progress</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {retainers.map(r => {
                    const fee = r.retainer_fee || 0;
                    const paid = r.amount_paid || 0;
                    const balance = fee - paid;
                    const pct = fee > 0 ? Math.round((paid / fee) * 100) : 0;
                    const statusColor = STATUS_COLORS[r.status] || '#6b7280';

                    return (
                      <tr key={r.id}>
                        <td><strong>{r.first_name} {r.last_name}</strong></td>
                        <td>{r.service_type || '\u2014'}</td>
                        <td>{fmt(fee)}</td>
                        <td style={{ color: 'var(--accent-green)' }}>{fmt(paid)}</td>
                        <td style={{ color: balance > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                          {fmt(balance)}
                        </td>
                        <td style={{ minWidth: 100 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-track" style={{ flex: 1, height: 6 }}>
                              <div className="progress-fill" style={{
                                width: `${pct}%`,
                                background: statusColor,
                              }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32 }}>{pct}%</span>
                          </div>
                        </td>
                        <td>{r.due_date || '\u2014'}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => {
                              setShowPayment(r);
                              setPayForm({ amount: '', payment_method: 'e-Transfer', payment_date: '', reference_number: '' });
                            }}
                          >
                            <CreditCard size={13} /> Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {retainers.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No retainers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ EMPLOYER INVOICES TAB ═══════════════ */}
      {tab === 'invoices' && (
        <>
          {loadingInvoices ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employer</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Invoice Date</th>
                      <th>Due Date</th>
                      <th>Paid Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const invStatus = inv.status || 'pending';
                      return (
                        <tr key={inv.id}>
                          <td><strong>{inv.employer_name}</strong></td>
                          <td>{inv.description || '\u2014'}</td>
                          <td>{fmt(inv.amount)}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[invStatus] || 'badge-gray'}`}>
                              {invStatus}
                            </span>
                          </td>
                          <td>{inv.invoice_date || inv.created_at?.slice(0, 10) || '\u2014'}</td>
                          <td>{inv.due_date || '\u2014'}</td>
                          <td>{inv.paid_date || '\u2014'}</td>
                          <td>
                            {invStatus !== 'paid' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 12 }}
                                onClick={() => handleMarkPaid(inv)}
                              >
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {invoices.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No invoices found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ NEW RETAINER MODAL ═══════════════ */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Retainer Agreement</div>
              <button className="modal-close" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Client *</label>
                <select className="form-input" value={newR.client_id} onChange={e => setNewR({ ...newR, client_id: e.target.value })}>
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Service Type</label>
                <input className="form-input" placeholder="e.g. Express Entry, Study Permit..." value={newR.service_type} onChange={e => setNewR({ ...newR, service_type: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Retainer Fee (CAD) *</label>
                <input type="number" className="form-input" placeholder="3500" value={newR.retainer_fee} onChange={e => setNewR({ ...newR, retainer_fee: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={newR.due_date} onChange={e => setNewR({ ...newR, due_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Signed Date</label>
                <input type="date" className="form-input" value={newR.signed_date} onChange={e => setNewR({ ...newR, signed_date: e.target.value })} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} placeholder="Additional notes..." value={newR.notes} onChange={e => setNewR({ ...newR, notes: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateRetainer} disabled={creatingRetainer || !newR.client_id || !newR.retainer_fee}>
                {creatingRetainer ? 'Creating...' : 'Create Retainer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RECORD PAYMENT MODAL ═══════════════ */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-title">Record Payment</div>
              <button className="modal-close" onClick={() => setShowPayment(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 24px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
              <strong>{showPayment.first_name} {showPayment.last_name}</strong> &mdash; {showPayment.service_type || 'Retainer'}
              <br />
              Balance: <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{fmt((showPayment.retainer_fee || 0) - (showPayment.amount_paid || 0))}</span>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Amount (CAD) *</label>
                <input type="number" className="form-input" placeholder="500" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-input" value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                  <option value="e-Transfer">e-Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" className="form-input" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Reference Number</label>
                <input className="form-input" placeholder="e.g. TXN-12345" value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPayment(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRecordPayment} disabled={recordingPayment || !payForm.amount}>
                {recordingPayment ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ADD INVOICE MODAL ═══════════════ */}
      {showInvoice && (
        <div className="modal-overlay" onClick={() => setShowInvoice(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-title">Add Employer Invoice</div>
              <button className="modal-close" onClick={() => setShowInvoice(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Employer *</label>
                <select className="form-input" value={invoiceForm.employer_id} onChange={e => setInvoiceForm({ ...invoiceForm, employer_id: e.target.value })}>
                  <option value="">Select employer...</option>
                  {employers.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="e.g. LMIA Processing Fee" value={invoiceForm.description} onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (CAD) *</label>
                <input type="number" className="form-input" placeholder="1000" value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={invoiceForm.due_date} onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowInvoice(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateInvoice} disabled={creatingInvoice || !invoiceForm.employer_id || !invoiceForm.amount}>
                {creatingInvoice ? 'Creating...' : 'Add Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
