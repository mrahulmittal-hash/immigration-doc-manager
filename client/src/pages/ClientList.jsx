import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Search, Users, Trash2, CheckCircle, Mail, Clock, Globe, Stamp } from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'lead',            label: 'Lead',            color: '#656d76' },
  { id: 'consultation',    label: 'Consultation',    color: '#3b82f6' },
  { id: 'retainer_signed', label: 'Retainer',        color: '#8b5cf6' },
  { id: 'in_progress',     label: 'In Progress',     color: '#f59e0b' },
  { id: 'submitted',       label: 'Submitted',       color: '#ec4899' },
  { id: 'approved',        label: 'Approved',        color: '#10b981' },
];

const STATUS_OPTS = ['all', 'active', 'inactive'];
const PIF_OPTS   = ['all', 'pending', 'sent', 'completed'];

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
  const pifIcon = { pending: Clock, sent: Mail, completed: CheckCircle };

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
          <span style={{ position: 'absolute', left: 14, top: 11, color: 'var(--text-muted)' }}><Search size={14} /></span>
          <input
            placeholder="Search by name, email, or nationality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
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
          <div className="empty-icon"><Users size={32} /></div>
          <div className="empty-title">No clients found</div>
          <div className="empty-text">Try changing your search or filters</div>
          <Link to="/clients/new" className="btn btn-primary" style={{ marginTop:12 }}>+ New Client</Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding:0, overflow:'hidden', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '16px 20px' }}>Client Name</th>
                  <th style={{ padding: '16px 20px' }}>Contact Info</th>
                  <th style={{ padding: '16px 20px' }}>Application</th>
                  <th style={{ padding: '16px 20px' }}>Workflow Stage</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  return (
                  <tr key={c.id}>
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
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop: 2, display:'flex', alignItems:'center', gap:4 }}>
                            {c.nationality ? <><Globe size={10} /> {c.nationality}</> : 'No nationality listed'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {c.email ? <div style={{ fontSize:13, color: 'var(--text-secondary)' }}>{c.email}</div> : <div style={{ fontSize:13, color:'var(--text-muted)' }}>No email</div>}
                      {c.phone && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop: 2 }}>{c.phone}</div>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {c.visa_type ? (
                        <span className="badge badge-primary">{c.visa_type}</span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {(() => {
                        const currentStage = c.pipeline_stage || 'lead';
                        const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === currentStage);
                        const stageInfo = PIPELINE_STAGES[currentIdx] || PIPELINE_STAGES[0];
                        return (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: stageInfo.color, marginBottom: 6 }}>
                              {stageInfo.label}
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {PIPELINE_STAGES.map((stage, idx) => (
                                <div key={stage.id} style={{
                                  width: 10, height: 10, borderRadius: '50%',
                                  background: idx <= currentIdx ? stage.color : 'var(--border)',
                                  border: idx === currentIdx ? `2px solid ${stage.color}` : '2px solid transparent',
                                  boxShadow: idx === currentIdx ? `0 0 0 2px ${stage.color}33` : 'none',
                                  transition: 'all 0.15s',
                                }} title={stage.label} />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display:'flex', gap:8, justifyContent: 'flex-end' }}>
                        <Link to={`/clients/${c.id}`} className="btn btn-ghost btn-sm">View File</Link>
                        <button className="btn btn-ghost btn-sm" style={{ color:'#ef4444', display:'flex', alignItems:'center' }} onClick={() => deleteClient(c.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
