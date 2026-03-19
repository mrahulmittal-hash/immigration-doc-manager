import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, FileText, Search, Users, CreditCard, AlertTriangle,
} from 'lucide-react';
import { API_URL } from '../api';

export default function TrustAccounting() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('clients');
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/accounting/summary`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('crm_access_token')}` },
      });
      const data = await res.json();
      setSummary(data);
    } catch (err) { console.error('Failed to load accounting:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

  const clientBalances = summary?.client_balances || [];
  const filteredClients = clientBalances.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || c.visa_type?.toLowerCase().includes(s);
  });

  const recentPayments = summary?.recent_payments || [];

  return (
    <div className="clients-3panel">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        <div style={{ padding: '16px 12px 8px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>Client Accounting</div>
          <div className="clients-search-wrap" style={{ padding: 0 }}>
            <Search size={14} className="clients-search-icon" style={{ left: 12 }} />
            <input className="clients-search-input" placeholder="Search clients..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, padding: '8px', background: 'rgba(99,102,241,.06)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#6366f1' }}>{fmt(summary?.total_invoiced)}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoiced</div>
          </div>
          <div style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,.06)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{fmt(summary?.total_collected)}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Collected</div>
          </div>
        </div>

        <div className="clients-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
          ) : filteredClients.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No clients found
            </div>
          ) : filteredClients.map(c => (
            <div key={c.client_id}
              className="clients-list-item"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/clients/${c.client_id}`)}
            >
              <div className="clients-item-avatar">
                {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
              </div>
              <div className="clients-item-info">
                <div className="clients-item-name">{c.first_name} {c.last_name}</div>
                <div className="clients-item-meta">{c.visa_type || 'No visa type'}</div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                color: c.balance_due > 0 ? '#ef4444' : '#10b981',
              }}>
                {c.balance_due > 0 ? fmt(c.balance_due) : 'Paid'}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card blue">
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={22} /></div>
              <div className="stat-value">{fmt(summary?.total_invoiced)}</div>
              <div className="stat-label">Total Invoiced</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={22} /></div>
              <div className="stat-value">{fmt(summary?.total_collected)}</div>
              <div className="stat-label">Total Collected</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={22} /></div>
              <div className="stat-value">{fmt(summary?.outstanding)}</div>
              <div className="stat-label">Outstanding</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={22} /></div>
              <div className="stat-value">{fmt(summary?.overdue)}</div>
              <div className="stat-label">Overdue</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="filter-bar" style={{ marginBottom: 0 }}>
            {[{ id: 'clients', label: 'Client Balances' }, { id: 'payments', label: 'Recent Payments' }].map(tab => (
              <button key={tab.id} className={`filter-pill ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Client Balances Table */}
          {activeTab === 'clients' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Client</th><th>Visa Type</th><th style={{ textAlign: 'right' }}>Invoiced</th><th style={{ textAlign: 'right' }}>Paid</th><th style={{ textAlign: 'right' }}>Balance Due</th></tr></thead>
                  <tbody>
                    {filteredClients.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No client data</td></tr>
                    ) : filteredClients.map(client => (
                      <tr key={client.client_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clients/${client.client_id}`)}>
                        <td>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{client.first_name} {client.last_name}</span>
                        </td>
                        <td><span className="badge badge-primary" style={{ fontSize: 11 }}>{client.visa_type || '—'}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#6366f1' }}>{fmt(client.total_invoiced)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#10b981' }}>{fmt(client.total_paid)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: client.balance_due > 0 ? '#ef4444' : '#10b981' }}>
                          {client.balance_due > 0 ? fmt(client.balance_due) : '✓ Paid'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Payments */}
          {activeTab === 'payments' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Client</th><th>Method</th><th>Reference</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {recentPayments.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No payments recorded yet</td></tr>
                    ) : recentPayments.map(p => (
                      <tr key={p.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                        <td>{p.first_name ? <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(`/clients/${p.client_id}`)}>{p.first_name} {p.last_name}</span> : '—'}</td>
                        <td><span style={{ fontSize: 12, fontWeight: 500 }}>{p.payment_method || '—'}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.reference_number || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#10b981' }}>+{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Financial Summary</div>
          <div className="clients-ctx-stat-row">
            <span>Total Invoiced</span>
            <strong style={{ color: '#6366f1', fontFamily: 'monospace' }}>{fmt(summary?.total_invoiced)}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Total Collected</span>
            <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{fmt(summary?.total_collected)}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Balance Due</span>
            <strong style={{ color: '#ef4444', fontFamily: 'monospace' }}>{fmt(summary?.balance_due)}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Overdue</span>
            <strong style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{fmt(summary?.overdue)}</strong>
          </div>
        </div>

        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Quick Info</div>
          <div className="clients-ctx-row">
            <Users size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12 }}>{clientBalances.length} active clients</span>
          </div>
          <div className="clients-ctx-row">
            <FileText size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12 }}>{clientBalances.filter(c => c.balance_due > 0).length} with outstanding balance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
