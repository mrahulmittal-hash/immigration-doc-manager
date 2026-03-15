import { useState } from 'react';

const SAMPLE_RETAINERS = [
  { id:1, client:'Anish Sharma',    service:'Express Entry',       amount:3500, paid:3500, status:'paid',    date:'2026-02-01', due:'2026-02-28' },
  { id:2, client:'Wei Chen',        service:'Study Permit',        amount:2200, paid:1100, status:'partial', date:'2026-02-15', due:'2026-03-15' },
  { id:3, client:'Phuong Nguyen',   service:'Spousal Sponsorship', amount:4200, paid:0,    status:'pending', date:'2026-03-01', due:'2026-03-31' },
  { id:4, client:'Raj Patel',       service:'Work Permit PGWP',    amount:1800, paid:1800, status:'paid',    date:'2026-01-10', due:'2026-02-10' },
  { id:5, client:'Maria Garcia',    service:'PR Application',      amount:5500, paid:2750, status:'partial', date:'2026-03-05', due:'2026-04-05' },
];

const STATUS_BADGE = {
  paid:    'badge-success',
  partial: 'badge-warning',
  pending: 'badge-danger',
  overdue: 'badge-danger',
};

export default function Retainers() {
  const [retainers, setRetainers] = useState(SAMPLE_RETAINERS);
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [newR, setNewR] = useState({ client:'', service:'', amount:'', paid:'0', due:'' });

  const filtered = filter === 'all' ? retainers : retainers.filter(r => r.status === filter);

  const totalBilled  = retainers.reduce((s,r) => s + r.amount, 0);
  const totalCollected = retainers.reduce((s,r) => s + r.paid, 0);
  const totalOutstanding = totalBilled - totalCollected;
  const paidCount  = retainers.filter(r => r.status === 'paid').length;
  const pendCount  = retainers.filter(r => r.status !== 'paid').length;

  function addRetainer() {
    if (!newR.client || !newR.amount) return;
    const amount = parseFloat(newR.amount) || 0;
    const paid   = parseFloat(newR.paid)   || 0;
    const status = paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'pending';
    setRetainers(prev => [...prev, { ...newR, id:Date.now(), amount, paid, status, date:new Date().toISOString().slice(0,10) }]);
    setNewR({ client:'', service:'', amount:'', paid:'0', due:'' });
    setShowNew(false);
  }

  function fmt(n) { return `$${n.toLocaleString('en-CA', { minimumFractionDigits:0 })}`; }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Retainers</div>
          <div className="page-subtitle">Track client payments and outstanding balances</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Retainer</button>
      </div>

      {/* Finance stats */}
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-icon">💰</div>
          <div className="stat-value">{fmt(totalCollected)}</div>
          <div className="stat-label">Total Collected</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{fmt(totalOutstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">📋</div>
          <div className="stat-value">{fmt(totalBilled)}</div>
          <div className="stat-label">Total Billed</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{paidCount}/{retainers.length}</div>
          <div className="stat-label">Paid in Full</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {['all','paid','partial','pending'].map(f => (
          <button key={f} className={`filter-pill ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Service</th>
                <th>Retainer Fee</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.client}</strong></td>
                  <td>{r.service || '—'}</td>
                  <td>{fmt(r.amount)}</td>
                  <td style={{ color:'var(--accent-green)' }}>{fmt(r.paid)}</td>
                  <td style={{ color: r.amount - r.paid > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                    {fmt(r.amount - r.paid)}
                  </td>
                  <td>{r.due}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>No retainers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Progress */}
      <div className="card" style={{ marginTop:20 }}>
        <div className="card-title" style={{ marginBottom:16 }}>Collection Progress</div>
        <div style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
            <span style={{ fontWeight:600 }}>Overall Collections</span>
            <span style={{ color:'var(--text-muted)' }}>
              {fmt(totalCollected)} / {fmt(totalBilled)} ({totalBilled ? Math.round((totalCollected/totalBilled)*100) : 0}%)
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width:`${totalBilled ? (totalCollected/totalBilled)*100 : 0}%` }} />
          </div>
        </div>
        {retainers.map(r => (
          <div key={r.id} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
              <span>{r.client}</span>
              <span style={{ color:'var(--text-muted)' }}>{Math.round((r.paid/r.amount)*100)||0}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width:`${(r.paid/r.amount)*100||0}%`,
                background: r.status==='paid' ? 'var(--accent-green)' : r.status==='partial' ? 'var(--accent-amber)' : 'var(--accent-red)'
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Retainer Agreement</div>
              <button className="modal-close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Client Name</label>
                <input className="form-input" placeholder="Full name" value={newR.client} onChange={e => setNewR({...newR, client:e.target.value})} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Service Type</label>
                <input className="form-input" placeholder="e.g. Express Entry, Study Permit…" value={newR.service} onChange={e => setNewR({...newR, service:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Retainer Fee (CAD)</label>
                <input type="number" className="form-input" placeholder="3500" value={newR.amount} onChange={e => setNewR({...newR, amount:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount Paid</label>
                <input type="number" className="form-input" placeholder="0" value={newR.paid} onChange={e => setNewR({...newR, paid:e.target.value})} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={newR.due} onChange={e => setNewR({...newR, due:e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addRetainer}>Create Retainer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
