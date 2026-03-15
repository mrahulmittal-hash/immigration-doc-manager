import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { DollarSign, Plus, CreditCard, ChevronDown, ChevronUp, X, Receipt } from 'lucide-react';

const STATUS_COLORS = {
  paid: '#10b981',
  partial: '#f59e0b',
  pending: '#6b7280',
  overdue: '#ef4444',
};

function fmt(n) {
  return `$${Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;
}

export default function RetainerPanel({ clientId }) {
  const [retainers, setRetainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [payments, setPayments] = useState({});
  const [addForm, setAddForm] = useState({ service_type: '', retainer_fee: '', due_date: '', signed_date: '', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'e-Transfer', payment_date: '', reference_number: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchRetainers = useCallback(async () => {
    try {
      const data = await api.getClientRetainers(clientId);
      setRetainers(data);
    } catch {
      setRetainers([]);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchRetainers(); }, [fetchRetainers]);

  const handleAddRetainer = async (e) => {
    e.preventDefault();
    if (!addForm.service_type || !addForm.retainer_fee) return;
    setSubmitting(true);
    try {
      await api.createRetainer(clientId, {
        ...addForm,
        retainer_fee: parseFloat(addForm.retainer_fee),
      });
      setAddForm({ service_type: '', retainer_fee: '', due_date: '', signed_date: '', notes: '' });
      setShowAddModal(false);
      fetchRetainers();
    } catch (err) {
      console.error('Failed to create retainer:', err);
    }
    setSubmitting(false);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount || !paymentModal) return;
    setSubmitting(true);
    try {
      await api.recordPayment(paymentModal, {
        ...payForm,
        amount: parseFloat(payForm.amount),
      });
      setPayForm({ amount: '', payment_method: 'e-Transfer', payment_date: '', reference_number: '', notes: '' });
      setPaymentModal(null);
      fetchRetainers();
      if (expandedId === paymentModal) {
        fetchPayments(paymentModal);
      }
    } catch (err) {
      console.error('Failed to record payment:', err);
    }
    setSubmitting(false);
  };

  const fetchPayments = async (retainerId) => {
    try {
      const data = await api.getPayments(retainerId);
      setPayments(prev => ({ ...prev, [retainerId]: data }));
    } catch {
      setPayments(prev => ({ ...prev, [retainerId]: [] }));
    }
  };

  const toggleExpand = (retainerId) => {
    if (expandedId === retainerId) {
      setExpandedId(null);
    } else {
      setExpandedId(retainerId);
      if (!payments[retainerId]) {
        fetchPayments(retainerId);
      }
    }
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Manage retainer agreements and track payments for this client.
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowAddModal(true)}>
          <Plus size={14} /> Add Retainer
        </button>
      </div>

      {retainers.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><DollarSign size={32} /></div>
            <div className="empty-title">No retainers yet</div>
            <div className="empty-text">Create a retainer agreement to track fees and payments for this client.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {retainers.map(r => {
            const fee = Number(r.retainer_fee) || 0;
            const paid = Number(r.amount_paid) || 0;
            const pct = fee > 0 ? Math.min((paid / fee) * 100, 100) : 0;
            const statusColor = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
            const isExpanded = expandedId === r.id;
            const retainerPayments = payments[r.id] || [];

            return (
              <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {r.service_type || 'Untitled Service'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                        {r.signed_date && <span>Signed: {new Date(r.signed_date).toLocaleDateString('en-CA')}</span>}
                        {r.due_date && <span>Due: {new Date(r.due_date).toLocaleDateString('en-CA')}</span>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      padding: '3px 10px', borderRadius: 12,
                      color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33`,
                    }}>
                      {r.status}
                    </span>
                  </div>

                  {/* Fee and progress */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {fmt(paid)} of {fmt(fee)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{Math.round(pct)}%</span>
                  </div>
                  <div style={{
                    height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 3, width: `${pct}%`,
                      background: statusColor, transition: 'width 0.3s ease',
                    }} />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => {
                        setPaymentModal(r.id);
                        setPayForm({ amount: '', payment_method: 'e-Transfer', payment_date: '', reference_number: '', notes: '' });
                      }}>
                      <CreditCard size={13} /> Record Payment
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => toggleExpand(r.id)}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      Payment History
                    </button>
                  </div>
                </div>

                {/* Expanded payment history */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '14px 20px' }}>
                    {retainerPayments.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                        No payments recorded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {retainerPayments.map(p => (
                          <div key={p.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Receipt size={14} style={{ color: 'var(--text-muted)' }} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                                  {fmt(p.amount)}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {p.payment_method || 'N/A'}
                                  {p.reference_number && ` — Ref: ${p.reference_number}`}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-CA') : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Retainer Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Retainer Agreement</div>
              <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddRetainer}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label className="form-label">Service Type</label>
                  <input className="form-input" placeholder="e.g. Express Entry, Study Permit"
                    value={addForm.service_type} onChange={e => setAddForm(f => ({ ...f, service_type: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Retainer Fee (CAD)</label>
                  <input type="number" step="0.01" className="form-input" placeholder="3500"
                    value={addForm.retainer_fee} onChange={e => setAddForm(f => ({ ...f, retainer_fee: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input"
                    value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Signed Date</label>
                  <input type="date" className="form-input"
                    value={addForm.signed_date} onChange={e => setAddForm(f => ({ ...f, signed_date: e.target.value }))} />
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Notes (optional)</label>
                  <textarea className="form-textarea" rows={3} placeholder="Additional details..."
                    value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Retainer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Record Payment</div>
              <button className="modal-close" onClick={() => setPaymentModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Amount (CAD)</label>
                  <input type="number" step="0.01" className="form-input" placeholder="500"
                    value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={payForm.payment_method}
                    onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                    <option value="e-Transfer">e-Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input type="date" className="form-input"
                    value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference Number</label>
                  <input className="form-input" placeholder="e.g. TXN-12345"
                    value={payForm.reference_number} onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))} />
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Notes (optional)</label>
                  <textarea className="form-textarea" rows={2} placeholder="Payment notes..."
                    value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPaymentModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
