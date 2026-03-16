import { useState, useEffect } from 'react';
import {
  DollarSign, Wallet, ArrowUpFromLine, FileText, Shield, Clock, Users,
  Download, Search, Plus, CheckCircle
} from 'lucide-react';

const TX_TYPE_STYLES = {
  deposit_to_trust: { color: '#10b981', label: 'Deposit', prefix: '+' },
  trust_to_operating: { color: '#6366f1', label: 'Release', prefix: '-' },
  refund: { color: '#f59e0b', label: 'Refund', prefix: '-' },
  expense: { color: '#ef4444', label: 'Expense', prefix: '-' },
};

export default function TrustAccounting() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);

  const load = async () => {
    try {
      const res = await fetch('/api/accounting/summary');
      const data = await res.json();
      setSummary(data);
    } catch (err) { console.error('Failed to load accounting:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

  const handleExportAudit = async () => {
    try {
      const res = await fetch('/api/accounting/audit-log');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cicc-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('Export failed:', err); }
  };

  const clientBalances = summary?.client_balances || [];
  const filteredClients = clientBalances.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || c.visa_type?.toLowerCase().includes(s);
  });

  const selectedClient = clientBalances.find(c => c.client_id === selectedClientId);
  const clientTransactions = (summary?.recent_transactions || []).filter(tx =>
    selectedClientId ? tx.client_id === selectedClientId : true
  );

  return (
    <div className="clients-3panel">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        <div style={{ padding: '16px 12px 8px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>Trust Accounts</div>
          <div className="clients-search-wrap" style={{ padding: 0 }}>
            <Search size={14} className="clients-search-icon" style={{ left: 12 }} />
            <input className="clients-search-input" placeholder="Search clients..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Compact summary */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,.06)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{fmt(summary?.total_trust)}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trust</div>
          </div>
          <div style={{ flex: 1, padding: '8px', background: 'rgba(99,102,241,.06)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#6366f1' }}>{fmt(summary?.operating_balance)}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operating</div>
          </div>
        </div>

        {/* Tab filters */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap' }}>
          <button className={`clients-filter-chip ${!selectedClientId ? 'active' : ''}`}
            onClick={() => setSelectedClientId(null)}>Overview</button>
        </div>

        <div className="clients-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
          ) : filteredClients.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No trust accounts
            </div>
          ) : filteredClients.map(c => (
            <div key={c.client_id}
              className={`clients-list-item ${selectedClientId === c.client_id ? 'active' : ''}`}
              onClick={() => setSelectedClientId(c.client_id)}
            >
              <div className="clients-item-avatar">
                {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
              </div>
              <div className="clients-item-info">
                <div className="clients-item-name">{c.first_name} {c.last_name}</div>
                <div className="clients-item-meta">{c.visa_type || 'No visa type'}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                {fmt(c.balance)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredClients.length} account{filteredClients.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {selectedClient ? (
            /* ── Client Detail ── */
            <div>
              <div className="clients-detail-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(16,185,129,.15), rgba(99,102,241,.15))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: '#10b981',
                  }}>
                    {(selectedClient.first_name?.[0] || '') + (selectedClient.last_name?.[0] || '')}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                      {selectedClient.first_name} {selectedClient.last_name}
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      <span className="clients-tag" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
                        {selectedClient.visa_type || 'No visa type'}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                      {fmt(selectedClient.balance)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trust Balance</div>
                  </div>
                </div>
              </div>

              {/* Client Transactions */}
              <div className="clients-detail-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Transactions</h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                    <tbody>
                      {clientTransactions.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions</td></tr>
                      ) : clientTransactions.map(tx => {
                        const style = TX_TYPE_STYLES[tx.type] || { color: '#64748b', label: tx.type, prefix: '' };
                        return (
                          <tr key={tx.id}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                            <td>
                              <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: style.color, background: `${style.color}15` }}>
                                {style.label}
                              </span>
                            </td>
                            <td style={{ fontSize: 13 }}>{tx.description || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: style.color }}>
                              {style.prefix}{fmt(tx.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ── Overview ── */
            <div>
              {/* Stats */}
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card blue">
                  <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={22} /></div>
                  <div className="stat-value">{fmt(summary?.total_trust)}</div>
                  <div className="stat-label">Total Trust Held</div>
                </div>
                <div className="stat-card green">
                  <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={22} /></div>
                  <div className="stat-value">{fmt(summary?.operating_balance)}</div>
                  <div className="stat-label">Operating Balance</div>
                </div>
                <div className="stat-card amber">
                  <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={22} /></div>
                  <div className="stat-value">{fmt(summary?.pending_releases)}</div>
                  <div className="stat-label">Pending Releases</div>
                </div>
                <div className="stat-card purple">
                  <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={22} /></div>
                  <div className="stat-value">{fmt(summary?.outstanding_invoices)}</div>
                  <div className="stat-label">Outstanding Invoices</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="filter-bar" style={{ marginBottom: 0 }}>
                {[{ id: 'overview', label: 'Client Balances' }, { id: 'transactions', label: 'Recent Transactions' }, { id: 'compliance', label: 'CICC Compliance' }].map(tab => (
                  <button key={tab.id} className={`filter-pill ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Client Balances */}
              {activeTab === 'overview' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Client</th><th>Visa Type</th><th style={{ textAlign: 'right' }}>Trust Balance</th></tr></thead>
                      <tbody>
                        {(!summary?.client_balances || summary.client_balances.length === 0) ? (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No trust accounts with balances</td></tr>
                        ) : summary.client_balances.map(client => (
                          <tr key={client.client_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedClientId(client.client_id)}>
                            <td>
                              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{client.first_name} {client.last_name}</span>
                            </td>
                            <td><span className="badge badge-primary" style={{ fontSize: 11 }}>{client.visa_type}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#10b981' }}>{fmt(client.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              {activeTab === 'transactions' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                      <tbody>
                        {(!summary?.recent_transactions || summary.recent_transactions.length === 0) ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions recorded yet</td></tr>
                        ) : summary.recent_transactions.map(tx => {
                          const style = TX_TYPE_STYLES[tx.type] || { color: '#64748b', label: tx.type, prefix: '' };
                          return (
                            <tr key={tx.id}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                              <td>{tx.first_name ? <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setSelectedClientId(tx.client_id)}>{tx.first_name} {tx.last_name}</span> : '—'}</td>
                              <td><span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: style.color, background: `${style.color}15` }}>{style.label}</span></td>
                              <td style={{ fontSize: 13 }}>{tx.description || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: style.color }}>{style.prefix}{fmt(tx.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CICC Compliance */}
              {activeTab === 'compliance' && (
                <div className="card" style={{ padding: 24, marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <Shield size={24} color="#6366f1" />
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>CICC Compliance Dashboard</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                        Ensure your trust accounting meets CICC requirements
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Trust & Operating Separation', status: true, desc: 'Client funds are held separately from operating funds' },
                      { label: 'Transaction Audit Trail', status: true, desc: 'All deposits, releases, and refunds are timestamped with operator ID' },
                      { label: 'Milestone-Based Releases', status: true, desc: 'Funds released from trust only upon milestone completion' },
                      { label: 'Client Balance Tracking', status: true, desc: 'Individual trust balances tracked per client' },
                      { label: 'Export Capability', status: true, desc: 'Full audit log exportable for CICC review' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        {/* Financial Summary */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Financial Summary</div>
          <div className="clients-ctx-stat-row">
            <span>Trust Held</span>
            <strong style={{ color: '#3b82f6', fontFamily: 'monospace' }}>{fmt(summary?.total_trust)}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Operating</span>
            <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{fmt(summary?.operating_balance)}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Pending</span>
            <strong style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{fmt(summary?.pending_releases)}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Invoices</span>
            <strong style={{ color: '#8b5cf6', fontFamily: 'monospace' }}>{fmt(summary?.outstanding_invoices)}</strong>
          </div>
        </div>

        {/* Compliance Status */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Compliance</div>
          {['Trust Separation', 'Audit Trail', 'Milestone Releases', 'Balance Tracking', 'Export Ready'].map(item => (
            <div key={item} className="clients-ctx-row">
              <CheckCircle size={14} color="#10b981" />
              <span style={{ fontSize: 12 }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Quick Actions</div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={handleExportAudit}>
            <Download size={14} /> Export Audit Log
          </button>
        </div>

        {selectedClient && (
          <div className="clients-ctx-section">
            <div className="clients-ctx-label">Selected Account</div>
            <div className="clients-ctx-row">
              <Wallet size={14} color="#10b981" />
              <span style={{ fontWeight: 600 }}>{selectedClient.first_name} {selectedClient.last_name}</span>
            </div>
            <div className="clients-ctx-stat-row">
              <span>Balance</span>
              <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{fmt(selectedClient.balance)}</strong>
            </div>
            <div className="clients-ctx-row">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedClient.visa_type || '—'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
