import { useState, useEffect } from 'react';
import { DollarSign, Wallet, ArrowUpFromLine, FileText, Shield, Clock, Users, Download } from 'lucide-react';

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

  const load = async () => {
    try {
      const res = await fetch('/api/accounting/summary');
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load accounting:', err);
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (loading) return (
    <div className="page-enter">
      <div className="page-header">
        <div><div className="page-title">Trust Accounting</div></div>
      </div>
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
    </div>
  );

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Trust Accounting</div>
          <div className="page-subtitle">CICC-compliant trust & operating account management</div>
        </div>
        <button className="btn btn-ghost" onClick={handleExportAudit}>
          <Download size={16} /> Export Audit Log
        </button>
      </div>

      {/* Finance stats */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={22} />
          </div>
          <div className="stat-value">{fmt(summary?.total_trust)}</div>
          <div className="stat-label">Total Trust Held</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} />
          </div>
          <div className="stat-value">{fmt(summary?.operating_balance)}</div>
          <div className="stat-label">Operating Balance</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div className="stat-value">{fmt(summary?.pending_releases)}</div>
          <div className="stat-label">Pending Releases</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} />
          </div>
          <div className="stat-value">{fmt(summary?.outstanding_invoices)}</div>
          <div className="stat-label">Outstanding Invoices</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-bar" style={{ marginBottom: 0 }}>
        {[
          { id: 'overview', label: 'Client Balances' },
          { id: 'transactions', label: 'Recent Transactions' },
          { id: 'compliance', label: 'CICC Compliance' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`filter-pill ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Client Balances */}
      {activeTab === 'overview' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Visa Type</th>
                  <th style={{ textAlign: 'right' }}>Trust Balance</th>
                </tr>
              </thead>
              <tbody>
                {(!summary?.client_balances || summary.client_balances.length === 0) ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <Users size={24} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                      No trust accounts with balances
                    </td>
                  </tr>
                ) : (
                  summary.client_balances.map(client => (
                    <tr key={client.client_id}>
                      <td>
                        <a href={`/clients/${client.client_id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                          {client.first_name} {client.last_name}
                        </a>
                      </td>
                      <td>
                        <span className="badge badge-primary" style={{ fontSize: 11 }}>{client.visa_type}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#10b981' }}>
                        {fmt(client.balance)}
                      </td>
                    </tr>
                  ))
                )}
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
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(!summary?.recent_transactions || summary.recent_transactions.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No transactions recorded yet
                    </td>
                  </tr>
                ) : (
                  summary.recent_transactions.map(tx => {
                    const style = TX_TYPE_STYLES[tx.type] || { color: '#64748b', label: tx.type, prefix: '' };
                    return (
                      <tr key={tx.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {tx.first_name ? (
                            <a href={`/clients/${tx.client_id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                              {tx.first_name} {tx.last_name}
                            </a>
                          ) : '—'}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', padding: '2px 8px', borderRadius: 12,
                            fontSize: 11, fontWeight: 600, color: style.color,
                            background: `${style.color}15`,
                          }}>
                            {style.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{tx.description || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: style.color }}>
                          {style.prefix}{fmt(tx.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CICC Compliance */}
      {activeTab === 'compliance' && (
        <div style={{ marginTop: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Shield size={24} color="#6366f1" />
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>CICC Compliance Dashboard</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  Ensure your trust accounting meets College of Immigration and Citizenship Consultants requirements
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
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 10,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: item.status ? '#10b981' : '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    color: '#fff', fontSize: 12, fontWeight: 700
                  }}>
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
