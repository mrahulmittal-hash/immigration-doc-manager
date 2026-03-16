import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import TrustAccountPanel from './TrustAccountPanel';
import FeeAdjustmentsPanel from './FeeAdjustmentsPanel';
import RetainerAgreementGenerator from './RetainerAgreementGenerator';
import {
  Wallet, FileText, Receipt, DollarSign, Plus, X, Loader, ChevronDown, ChevronUp,
} from 'lucide-react';

const VIEWS = [
  { id: 'overview', label: 'Trust Account', Icon: Wallet },
  { id: 'invoices', label: 'Invoices', Icon: FileText },
  { id: 'retainers', label: 'Retainers', Icon: Receipt },
];

const STATUS_COLORS = {
  draft: 'badge-gray', sent: 'badge-primary', paid: 'badge-success',
  overdue: 'badge-danger', partial: 'badge-warning',
  active: 'badge-primary', pending: 'badge-warning', completed: 'badge-success',
};

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

export default function AccountingPanel({ clientId }) {
  const [view, setView] = useState('overview');
  const [invoices, setInvoices] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ description: '', amount: '', due_date: '' });
  const [showNewRetainer, setShowNewRetainer] = useState(false);
  const [newRetainer, setNewRetainer] = useState({ service_type: '', retainer_fee: '', due_date: '' });
  const [serviceFees, setServiceFees] = useState([]);
  const [expandedRetainer, setExpandedRetainer] = useState(null);

  useEffect(() => {
    api.getActiveServiceFees().then(setServiceFees).catch(() => {});
  }, []);

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

  useEffect(() => {
    if (view === 'invoices') fetchInvoices();
    if (view === 'retainers') fetchRetainers();
  }, [view, clientId]);

  const handleCreateInvoice = async () => {
    if (!newInvoice.description || !newInvoice.amount) return;
    try {
      await api.createInvoice(clientId, { ...newInvoice, amount: parseFloat(newInvoice.amount) });
      setNewInvoice({ description: '', amount: '', due_date: '' });
      setShowNewInvoice(false);
      fetchInvoices();
    } catch (e) { console.error('Failed to create invoice:', e); }
  };

  const handleUpdateInvoiceStatus = async (id, status) => {
    try {
      await api.updateInvoice(id, { status, paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null });
      fetchInvoices();
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

  return (
    <div>
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

      {/* Trust Account Overview */}
      {view === 'overview' && <TrustAccountPanel clientId={clientId} />}

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
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="form-input" placeholder="Description..." value={newInvoice.description}
                  onChange={e => setNewInvoice({ ...newInvoice, description: e.target.value })} style={{ flex: 1 }} />
                <input className="form-input" type="number" placeholder="Amount" value={newInvoice.amount}
                  onChange={e => setNewInvoice({ ...newInvoice, amount: e.target.value })} style={{ width: 120 }} />
                <input className="form-input" type="date" value={newInvoice.due_date}
                  onChange={e => setNewInvoice({ ...newInvoice, due_date: e.target.value })} style={{ width: 150 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewInvoice(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleCreateInvoice}>Create</button>
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
                <div key={inv.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {inv.invoice_number}
                      <span className={`badge ${STATUS_COLORS[inv.status] || 'badge-gray'}`} style={{ fontSize: 10 }}>{inv.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{inv.description}</div>
                    {inv.due_date && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Due: {new Date(inv.due_date).toLocaleDateString()}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: inv.status === 'paid' ? '#10b981' : 'var(--text-primary)' }}>{fmt(inv.amount)}</div>
                    {inv.status !== 'paid' && (
                      <select className="form-select" value={inv.status} onChange={e => handleUpdateInvoiceStatus(inv.id, e.target.value)}
                        style={{ fontSize: 11, padding: '4px 8px', width: 90 }}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    )}
                  </div>
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
                    {/* Payment progress bar */}
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(paidPct, 100)}%`, background: paidPct >= 100 ? '#10b981' : '#6366f1', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{paidPct}% paid • {fmt(ret.retainer_fee - ret.amount_paid)} remaining</div>

                    {/* Expand/collapse for adjustments + agreement */}
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
