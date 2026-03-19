import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import FeeAdjustmentsPanel from './FeeAdjustmentsPanel';
import RetainerAgreementGenerator from './RetainerAgreementGenerator';
import {
  FileText, Receipt, DollarSign, Plus, X, Loader, ChevronDown, ChevronUp, Download, Mail,
} from 'lucide-react';

const VIEWS = [
  { id: 'invoices', label: 'Invoices', Icon: FileText },
  { id: 'payments', label: 'Payments', Icon: DollarSign },
  { id: 'retainers', label: 'Retainers', Icon: Receipt },
];

const STATUS_COLORS = {
  draft: 'badge-gray', sent: 'badge-primary', paid: 'badge-success',
  overdue: 'badge-danger', partial: 'badge-warning', partially_paid: 'badge-warning',
  active: 'badge-primary', pending: 'badge-warning', completed: 'badge-success',
};

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

export default function AccountingPanel({ clientId }) {
  const [view, setView] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [balance, setBalance] = useState({ total_invoiced: 0, total_paid: 0, balance_due: 0 });
  const [loading, setLoading] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ description: '', amount: '', due_date: '', line_items: [{ description: '', amount: '', quantity: 1 }] });
  const [showNewRetainer, setShowNewRetainer] = useState(false);
  const [newRetainer, setNewRetainer] = useState({ service_type: '', retainer_fee: '', due_date: '' });
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', payment_method: 'e-transfer', reference_number: '', payment_date: new Date().toISOString().split('T')[0], invoice_id: '', retainer_id: '', notes: '' });
  const [serviceFees, setServiceFees] = useState([]);
  const [expandedRetainer, setExpandedRetainer] = useState(null);

  useEffect(() => {
    api.getActiveServiceFees().then(setServiceFees).catch(() => {});
    api.getClientBalance(clientId).then(setBalance).catch(() => {});
  }, [clientId]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getClientInvoices(clientId); setInvoices(data); }
    catch { setInvoices([]); }
    setLoading(false);
  }, [clientId]);

  const fetchRetainers = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getClientRetainers(clientId); setRetainers(data); }
    catch { setRetainers([]); }
    setLoading(false);
  }, [clientId]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getClientPayments(clientId); setPayments(data); }
    catch { setPayments([]); }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (view === 'invoices') fetchInvoices();
    if (view === 'retainers') fetchRetainers();
    if (view === 'payments') fetchPayments();
  }, [view, clientId]);

  const refreshBalance = () => api.getClientBalance(clientId).then(setBalance).catch(() => {});

  const handleCreateInvoice = async () => {
    const lineItems = newInvoice.line_items.filter(li => li.description && li.amount);
    const totalAmount = lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) * (parseInt(li.quantity) || 1)), 0);
    if (lineItems.length === 0) return;
    try {
      await api.createInvoice(clientId, {
        description: lineItems.map(li => li.description).join(', '),
        amount: totalAmount,
        due_date: newInvoice.due_date,
        line_items: lineItems,
      });
      setNewInvoice({ description: '', amount: '', due_date: '', line_items: [{ description: '', amount: '', quantity: 1 }] });
      setShowNewInvoice(false);
      fetchInvoices();
      refreshBalance();
    } catch (e) { console.error('Failed to create invoice:', e); }
  };

  const handleUpdateInvoiceStatus = async (id, status) => {
    try {
      await api.updateInvoice(id, { status, paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null });
      fetchInvoices();
      refreshBalance();
    } catch (e) { console.error('Failed to update invoice:', e); }
  };

  const handleCreateRetainer = async () => {
    if (!newRetainer.service_type || !newRetainer.retainer_fee) return;
    try {
      await api.createRetainer(clientId, { ...newRetainer, retainer_fee: parseFloat(newRetainer.retainer_fee) });
      setNewRetainer({ service_type: '', retainer_fee: '', due_date: '' });
      setShowNewRetainer(false);
      fetchRetainers();
    } catch (e) { console.error('Failed to create retainer:', e); }
  };

  const handleRecordPayment = async () => {
    if (!newPayment.amount) return;
    try {
      await api.recordClientPayment(clientId, {
        ...newPayment,
        amount: parseFloat(newPayment.amount),
        retainer_id: newPayment.retainer_id || null,
        invoice_id: newPayment.invoice_id || null,
      });
      setNewPayment({ amount: '', payment_method: 'e-transfer', reference_number: '', payment_date: new Date().toISOString().split('T')[0], invoice_id: '', retainer_id: '', notes: '' });
      setShowNewPayment(false);
      fetchPayments();
      refreshBalance();
    } catch (e) { console.error('Failed to record payment:', e); }
  };

  const addLineItem = () => {
    setNewInvoice(prev => ({ ...prev, line_items: [...prev.line_items, { description: '', amount: '', quantity: 1 }] }));
  };
  const updateLineItem = (i, field, value) => {
    setNewInvoice(prev => {
      const items = [...prev.line_items];
      items[i] = { ...items[i], [field]: value };
      return { ...prev, line_items: items };
    });
  };
  const removeLineItem = (i) => {
    setNewInvoice(prev => ({ ...prev, line_items: prev.line_items.filter((_, idx) => idx !== i) }));
  };

  const lineItemsTotal = newInvoice.line_items.reduce((sum, li) => sum + (parseFloat(li.amount || 0) * (parseInt(li.quantity) || 1)), 0);

  return (
    <div>
      {/* Balance Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Invoiced</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>{fmt(balance.total_invoiced)}</div>
        </div>
        <div className="card" style={{ padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>{fmt(balance.total_paid)}</div>
        </div>
        <div className="card" style={{ padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: balance.balance_due > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>{fmt(balance.balance_due)}</div>
        </div>
      </div>

      {/* View pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {VIEWS.map(v => (
          <button key={v.id}
            onClick={() => setView(v.id)}
            className={`filter-pill ${view === v.id ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 14px' }}>
            <v.Icon size={13} /> {v.label}
          </button>
        ))}
      </div>

      {/* Invoices */}
      {view === 'invoices' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Invoices</h4>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewInvoice(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={14} /> New Invoice
            </button>
          </div>

          {showNewInvoice && (
            <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Line Items</div>
              {newInvoice.line_items.map((li, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input className="form-input" placeholder="Description" value={li.description}
                    onChange={e => updateLineItem(i, 'description', e.target.value)} style={{ flex: 2 }} />
                  <input className="form-input" type="number" placeholder="Qty" value={li.quantity}
                    onChange={e => updateLineItem(i, 'quantity', e.target.value)} style={{ width: 60 }} />
                  <input className="form-input" type="number" placeholder="Amount" value={li.amount}
                    onChange={e => updateLineItem(i, 'amount', e.target.value)} style={{ width: 110 }} />
                  {newInvoice.line_items.length > 1 && (
                    <button onClick={() => removeLineItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)' }}><X size={14} /></button>
                  )}
                </div>
              ))}
              <button onClick={addLineItem} className="btn btn-ghost btn-sm" style={{ marginBottom: 10, fontSize: 11 }}>
                <Plus size={12} /> Add Line
              </button>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input className="form-input" type="date" value={newInvoice.due_date}
                  onChange={e => setNewInvoice({ ...newInvoice, due_date: e.target.value })} style={{ width: 150 }} />
                <div style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800 }}>Total: {fmt(lineItemsTotal)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewInvoice(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleCreateInvoice}>Create Invoice</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader size={24} className="spin" style={{ color: 'var(--accent-teal)' }} /></div>
          ) : invoices.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No invoices yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invoices.map(inv => (
                <div key={inv.id} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {inv.invoice_number}
                        <span className={`badge ${STATUS_COLORS[inv.status] || 'badge-gray'}`} style={{ fontSize: 10 }}>{inv.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{inv.description}</div>
                      {inv.due_date && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Due: {new Date(inv.due_date).toLocaleDateString()}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: inv.status === 'paid' ? '#10b981' : 'var(--text-primary)' }}>{fmt(inv.amount)}</div>
                      {inv.status !== 'paid' && (
                        <select className="form-select" value={inv.status} onChange={e => handleUpdateInvoiceStatus(inv.id, e.target.value)}
                          style={{ fontSize: 11, padding: '4px 8px', width: 100 }}>
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="partially_paid">Partial</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      )}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
                    <a href={api.getInvoicePDFUrl(inv.id)} target="_blank" rel="noreferrer"
                      className="btn btn-ghost btn-sm" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Download size={12} /> PDF
                    </a>
                    <button className="btn btn-ghost btn-sm" onClick={() => api.emailInvoice(inv.id).then(() => alert('Invoice emailed!')).catch(e => alert(e.message))}
                      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={12} /> Email
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments */}
      {view === 'payments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Payments</h4>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewPayment(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={14} /> Record Payment
            </button>
          </div>

          {showNewPayment && (
            <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--bg-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount *</label>
                  <input className="form-input" type="number" placeholder="0.00" value={newPayment.amount}
                    onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Method</label>
                  <select className="form-select" value={newPayment.payment_method}
                    onChange={e => setNewPayment({ ...newPayment, payment_method: e.target.value })}>
                    <option value="e-transfer">E-Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit-card">Credit Card</option>
                    <option value="wire">Wire Transfer</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Reference #</label>
                  <input className="form-input" placeholder="Reference number" value={newPayment.reference_number}
                    onChange={e => setNewPayment({ ...newPayment, reference_number: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date</label>
                  <input className="form-input" type="date" value={newPayment.payment_date}
                    onChange={e => setNewPayment({ ...newPayment, payment_date: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Invoice (optional)</label>
                  <select className="form-select" value={newPayment.invoice_id}
                    onChange={e => setNewPayment({ ...newPayment, invoice_id: e.target.value })}>
                    <option value="">No linked invoice</option>
                    {invoices.filter(i => i.status !== 'paid').map(i => (
                      <option key={i.id} value={i.id}>{i.invoice_number} — {fmt(i.amount)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Retainer (optional)</label>
                  <select className="form-select" value={newPayment.retainer_id}
                    onChange={e => setNewPayment({ ...newPayment, retainer_id: e.target.value })}>
                    <option value="">No linked retainer</option>
                    {retainers.map(r => (
                      <option key={r.id} value={r.id}>{r.service_type} — {fmt(r.retainer_fee)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes</label>
                <input className="form-input" placeholder="Payment notes..." value={newPayment.notes}
                  onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewPayment(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleRecordPayment}>Record Payment</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader size={24} className="spin" style={{ color: 'var(--accent-teal)' }} /></div>
          ) : payments.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No payments recorded yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map(p => (
                <div key={p.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {fmt(p.amount)}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>
                        via {p.payment_method || 'N/A'}
                      </span>
                    </div>
                    {p.reference_number && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Ref: {p.reference_number}</div>}
                    {p.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{p.notes}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <a href={api.getReceiptPDFUrl(p.id)} target="_blank" rel="noreferrer"
                    className="btn btn-ghost btn-sm" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Download size={12} /> Receipt
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Retainers */}
      {view === 'retainers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Retainer Agreements</h4>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewRetainer(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={14} /> New Retainer
            </button>
          </div>

          {showNewRetainer && (
            <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select className="form-select" value={newRetainer.service_type}
                  onChange={e => {
                    const sf = serviceFees.find(f => f.service_name === e.target.value);
                    setNewRetainer({ ...newRetainer, service_type: e.target.value, retainer_fee: sf ? sf.base_fee : newRetainer.retainer_fee });
                  }} style={{ flex: 1 }}>
                  <option value="">Select service...</option>
                  {serviceFees.map(sf => (
                    <option key={sf.id} value={sf.service_name}>{sf.service_name} — ${Number(sf.base_fee).toLocaleString()}</option>
                  ))}
                  <option value="__custom__">Other (custom)</option>
                </select>
                {newRetainer.service_type === '__custom__' && (
                  <input className="form-input" placeholder="Custom service..." value={newRetainer.service_type === '__custom__' ? '' : newRetainer.service_type}
                    onChange={e => setNewRetainer({ ...newRetainer, service_type: e.target.value })} style={{ flex: 1 }} />
                )}
                <input className="form-input" type="number" placeholder="Fee" value={newRetainer.retainer_fee}
                  onChange={e => setNewRetainer({ ...newRetainer, retainer_fee: e.target.value })} style={{ width: 120 }} />
                <input className="form-input" type="date" value={newRetainer.due_date}
                  onChange={e => setNewRetainer({ ...newRetainer, due_date: e.target.value })} style={{ width: 150 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewRetainer(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleCreateRetainer}>Create</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader size={24} className="spin" style={{ color: 'var(--accent-teal)' }} /></div>
          ) : retainers.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No retainers yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {retainers.map(ret => {
                const paidPct = ret.retainer_fee > 0 ? Math.round((ret.amount_paid / ret.retainer_fee) * 100) : 0;
                return (
                  <div key={ret.id} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ret.service_type}
                          <span className={`badge ${STATUS_COLORS[ret.status] || 'badge-gray'}`} style={{ fontSize: 10 }}>{ret.status}</span>
                        </div>
                        {ret.signed_date && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Signed: {new Date(ret.signed_date).toLocaleDateString()}</div>}
                        {ret.due_date && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due: {new Date(ret.due_date).toLocaleDateString()}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(ret.retainer_fee)}</div>
                        <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Paid: {fmt(ret.amount_paid)}</div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(paidPct, 100)}%`, background: paidPct >= 100 ? '#10b981' : '#6366f1', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{paidPct}% paid • {fmt(ret.retainer_fee - ret.amount_paid)} remaining</div>

                    <button
                      onClick={() => setExpandedRetainer(expandedRetainer === ret.id ? null : ret.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginTop: 8 }}
                    >
                      {expandedRetainer === ret.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expandedRetainer === ret.id ? 'Hide Details' : 'Adjustments & Agreement'}
                    </button>
                    {expandedRetainer === ret.id && (
                      <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        <FeeAdjustmentsPanel clientId={clientId} retainerId={ret.id} baseFee={ret.retainer_fee} />
                        <RetainerAgreementGenerator clientId={clientId} retainerId={ret.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
