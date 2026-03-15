import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STATUS_OPTS = ['all', 'active', 'inactive'];
const PIF_OPTS   = ['all', 'pending', 'sent', 'completed'];
const VISA_TYPES = ['Express Entry', 'Study Permit', 'Work Permit', 'Spousal Sponsorship', 'Visitor Visa', 'PR Application', 'Citizenship', 'Other'];

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('all');
  const [pif, setPif]         = useState('all');

  useEffect(() => {
    api.getClients().then(setClients).finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    if (q && !name.includes(q) && !(c.email||'').toLowerCase().includes(q) && !(c.nationality||'').toLowerCase().includes(q)) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (pif    !== 'all' && c.pif_status !== pif) return false;
    return true;
  });

  async function deleteClient(id) {
    if (!confirm('Delete this client?')) return;
    await api.deleteClient(id);
    setClients(prev => prev.filter(c => c.id !== id));
  }

  const pifBadge = { pending:'badge-warning', sent:'badge-primary', completed:'badge-success' };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Contacts & Clients</div>
          <div className="page-subtitle">Manage all individuals and their application forms in your practice.</div>
        </div>
        <Link to="/clients/new" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>+ Add Client</Link>
      </div>

      {/* Modern Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: 10, opacity: 0.5, fontSize: 13 }}>🔍</span>
          <input 
            placeholder="Search by name, email, or nationality..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{
              width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8,
              background: 'var(--bg-app)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="form-select" style={{ minWidth: 150 }} value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Account Status' : `Account: ${s.charAt(0).toUpperCase()+s.slice(1)}`}</option>)}
          </select>
          <select className="form-select" style={{ minWidth: 150 }} value={pif} onChange={e => setPif(e.target.value)}>
            {PIF_OPTS.map(p => <option key={p} value={p}>{p === 'all' ? 'All PIF Status' : 'PIF: '+p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="spinner-container"><div className="spinner" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="empty">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No clients found</div>
          <div className="empty-text">Try changing your search or filters</div>
          <Link to="/clients/new" className="btn btn-primary" style={{ marginTop:12 }}>+ New Client</Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding:0, overflow:'hidden', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Client Name</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Contact Info</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Application</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>PIF Status</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600 }}>Account</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{
                          width:36, height:36, borderRadius:'10px', flexShrink:0,
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:13, fontWeight:700, color:'#10b981',
                          border: '1px solid rgba(16,185,129,0.3)'
                        }}>
                          {c.first_name[0]}{c.last_name[0]}
                        </div>
                        <div>
                          <Link to={`/clients/${c.id}`} style={{ fontWeight:700, color:'var(--text-primary)', fontSize:14, textDecoration: 'none' }}>
                            {c.first_name} {c.last_name}
                          </Link>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop: 2 }}>{c.nationality ? `🇨🇦 ${c.nationality}` : 'No nationality listed'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {c.email ? <div style={{ fontSize:13, color: 'var(--text-secondary)' }}>{c.email}</div> : <div style={{ fontSize:13, color:'var(--text-muted)' }}>No email</div>}
                      {c.phone && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop: 2 }}>{c.phone}</div>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {c.visa_type ? (
                        <span style={{ 
                          background: 'rgba(59,130,246,0.1)', color: '#60a5fa', 
                          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 
                        }}>
                          {c.visa_type}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className={`badge ${pifBadge[c.pif_status] || 'badge-gray'}`} style={{ padding: '4px 10px', fontSize: 11 }}>
                        {c.pif_status === 'completed' ? '✓ Completed' : c.pif_status === 'sent' ? '✉ Sent' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'active' ? '#10b981' : '#64748b' }} />
                        <span style={{ fontSize: 13, color: c.status === 'active' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display:'flex', gap:8, justifyContent: 'flex-end' }}>
                        <Link to={`/clients/${c.id}`} className="btn btn-ghost btn-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>View File</Link>
                        <button className="btn btn-ghost btn-sm" style={{ color:'#ef4444', background: 'rgba(239, 68, 68, 0.05)' }} onClick={() => deleteClient(c.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
