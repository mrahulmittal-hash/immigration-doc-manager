import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Search, Users, Trash2, CheckCircle, Mail, Clock, Globe, Stamp, Phone, Pencil, Plus, ArrowRight, Calendar, Upload, AlertTriangle, MessageSquare, ListChecks, Send, Briefcase } from 'lucide-react';
import NotesPanel from '../components/NotesPanel';
import CaseLifecycle from '../components/CaseLifecycle';

const PIPELINE_STAGES = [
  { id: 'lead',            label: 'Lead',            color: '#656d76' },
  { id: 'consultation',    label: 'Consultation',    color: '#3b82f6' },
  { id: 'retainer_signed', label: 'Retainer',        color: '#8b5cf6' },
  { id: 'in_progress',     label: 'In Progress',     color: '#f59e0b' },
  { id: 'submitted',       label: 'Submitted',       color: '#ec4899' },
  { id: 'approved',        label: 'Approved',        color: '#10b981' },
];

const STATUS_OPTS = ['all', 'active', 'inactive'];
const PIF_OPTS = ['all', 'pending', 'sent', 'completed'];

const PIF_META = {
  pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: 'Pending', Icon: Clock },
  sent:      { color: '#3b82f6', bg: 'rgba(59,130,246,.12)',  label: 'Sent',    Icon: Mail },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,.12)',  label: 'Completed', Icon: CheckCircle },
};

const VISA_TAG_COLORS = {
  'Express Entry':       { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
  'Study Permit':        { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  'Work Permit (PGWP)':  { bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },
  'Spousal Sponsorship': { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
  'PR Application':      { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  'Refugee Claim':       { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  'Work Permit (LMIA)':  { bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },
};

function calcCompletion(client) {
  let score = 0, total = 0;
  // Checklist progress (50%)
  if (client.checklist_progress?.total > 0) {
    score += (client.checklist_progress.completed / client.checklist_progress.total) * 50;
  }
  total += 50;
  // PIF (25%)
  if (client.pif_status === 'completed') score += 25;
  else if (client.pif_status === 'sent') score += 10;
  total += 25;
  // Documents (25%)
  const docCount = client.documents?.length || 0;
  if (docCount >= 5) score += 25;
  else if (docCount > 0) score += (docCount / 5) * 25;
  total += 25;
  return Math.round((score / total) * 100);
}

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pif, setPif] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deadlines, setDeadlines] = useState([]);
  const navigate = useNavigate();

  const deleteClient = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      await api.deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
      if (selectedId === id) { setSelectedId(null); setSelectedClient(null); }
    } catch (e) { console.error('Delete failed:', e); }
  };

  useEffect(() => {
    api.getClients().then(data => {
      setClients(data);
      if (data.length > 0) {
        setSelectedId(data[0].id);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    Promise.all([
      api.getClient(selectedId),
      api.getDeadlines(selectedId).catch(() => []),
    ]).then(([client, dl]) => {
      setSelectedClient(client);
      setDeadlines(dl.filter(d => d.status === 'pending').slice(0, 3));
    }).catch(() => {
      setSelectedClient(null);
      setDeadlines([]);
    }).finally(() => setDetailLoading(false));
  }, [selectedId]);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    if (q && !name.includes(q) && !(c.email || '').toLowerCase().includes(q) && !(c.nationality || '').toLowerCase().includes(q)) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (pif !== 'all' && c.pif_status !== pif) return false;
    return true;
  });

  const pifBadgeStyle = (pifStatus) => {
    const meta = PIF_META[pifStatus] || PIF_META.pending;
    return { background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` };
  };

  const visaTagStyle = (visaType) => {
    const c = VISA_TAG_COLORS[visaType] || { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
    return { background: c.bg, color: c.color, border: `1px solid ${c.border}` };
  };

  const stageBadge = (stage) => {
    const s = PIPELINE_STAGES.find(p => p.id === stage) || PIPELINE_STAGES[0];
    return { background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}33` };
  };

  function getDaysUntil(ds) { return Math.ceil((new Date(ds) - new Date()) / (1000 * 60 * 60 * 24)); }
  function getUrgencyColor(days) { return days <= 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#10b981'; }

  const completion = selectedClient ? calcCompletion(selectedClient) : 0;

  return (
    <div className="clients-3panel">
      {/* ═══ LEFT PANEL: Client List ═══ */}
      <div className="clients-sidebar">
        <Link to="/clients/new" className="clients-add-btn">
          <Plus size={16} /> Add Client
        </Link>

        <div className="clients-sidebar-header">
          <span className="clients-sidebar-title">Clients ({filtered.length})</span>
        </div>

        <div className="clients-search-wrap">
          <Search size={14} className="clients-search-icon" />
          <input
            placeholder="Search name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clients-search-input"
          />
        </div>

        {/* Filter chips */}
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PIF_OPTS.map(p => (
            <button key={p}
              className={`clients-filter-chip ${pif === p ? 'active' : ''}`}
              onClick={() => setPif(p === pif ? 'all' : p)}
            >
              {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>}

        <div className="clients-list">
          {filtered.map(c => {
            const isActive = c.id === selectedId;
            const pifMeta = PIF_META[c.pif_status] || PIF_META.pending;
            const stage = PIPELINE_STAGES.find(p => p.id === c.pipeline_stage) || PIPELINE_STAGES[0];
            return (
              <div
                key={c.id}
                className={`clients-list-item ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="clients-item-avatar">
                  {c.first_name[0]}{c.last_name[0]}
                </div>
                <div className="clients-item-info">
                  <div className="clients-item-name">{c.first_name} {c.last_name}</div>
                  <div className="clients-item-meta">
                    {c.phone || c.email || 'No contact info'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span className="clients-item-badge" style={pifBadgeStyle(c.pif_status)}>
                    {c.pif_status === 'completed' ? 'Done' : c.pif_status === 'sent' ? 'Sent' : 'New'}
                  </span>
                  <span className="clients-item-badge" style={{
                    ...stageBadge(c.pipeline_stage),
                    fontSize: 9, padding: '1px 6px',
                  }}>
                    {stage.label}
                  </span>
                </div>
              </div>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No clients match your search
            </div>
          )}
        </div>
      </div>

      <div className="clients-center">
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

        {detailLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div className="spinner" />
          </div>
        )}

        {selectedClient && !detailLoading && (
          <div className="clients-center-scroll">
            {/* Client Header Card */}
            <div className="clients-detail-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                    {selectedClient.first_name} {selectedClient.last_name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                    {selectedClient.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={13} /> {selectedClient.phone}</span>}
                    {selectedClient.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={13} /> {selectedClient.email}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {selectedClient.visa_type && (
                      <span className="clients-tag" style={visaTagStyle(selectedClient.visa_type)}>
                        {selectedClient.visa_type}
                      </span>
                    )}
                    {selectedClient.nationality && (
                      <span className="clients-tag" style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                        <Globe size={11} /> {selectedClient.nationality}
                      </span>
                    )}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                  onClick={() => navigate(`/clients/${selectedClient.id}`)}>
                  <Pencil size={13} /> Edit
                </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div style={{
              display: 'flex', gap: 8, padding: '0 2px', flexWrap: 'wrap',
            }}>
              {[
                { icon: Upload, label: 'Upload Doc', tab: 'documents' },
                { icon: AlertTriangle, label: 'Add Deadline', tab: 'deadlines' },
                { icon: MessageSquare, label: 'Add Note', tab: 'notes' },
                { icon: ListChecks, label: 'Checklist', tab: 'checklist' },
                { icon: Send, label: 'Send PIF', tab: 'pif' },
                { icon: Users, label: 'Family', tab: 'family' },
              ].map(a => (
                <button key={a.tab} className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '6px 10px' }}
                  onClick={() => navigate(`/clients/${selectedClient.id}`)}>
                  <a.icon size={13} /> {a.label}
                </button>
              ))}
            </div>

            {/* Immigration Case Lifecycle */}
            <div className="clients-detail-card">
              <CaseLifecycle client={selectedClient} />
            </div>

            {/* Two-column: Deadlines + Checklist Progress */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Upcoming Deadlines */}
              <div className="clients-detail-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Upcoming Deadlines
                </div>
                {deadlines.length > 0 ? deadlines.map((dl, i) => {
                  const days = getDaysUntil(dl.deadline_date);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                      borderBottom: i < deadlines.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}>
                      <div style={{ width: 3, height: 24, borderRadius: 2, background: getUrgencyColor(days), flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{dl.title}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dl.category}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: getUrgencyColor(days) }}>
                        {days <= 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                      </span>
                    </div>
                  );
                }) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                    No upcoming deadlines
                  </div>
                )}
              </div>

              {/* Checklist Progress */}
              <div className="clients-detail-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Document Checklist
                </div>
                {selectedClient.checklist_progress?.total > 0 ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{selectedClient.checklist_progress.completed} / {selectedClient.checklist_progress.total} uploaded</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {Math.round((selectedClient.checklist_progress.completed / selectedClient.checklist_progress.total) * 100)}%
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
                        background: 'linear-gradient(90deg, #10b981, #059669)',
                        width: `${(selectedClient.checklist_progress.completed / selectedClient.checklist_progress.total) * 100}%`,
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      {selectedClient.checklist_progress.missing} missing
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/clients/${selectedClient.id}`)}>
                      Initialize checklist
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Activity */}
            <div className="clients-detail-card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Notes & Activity</div>
              <NotesPanel clientId={selectedClient.id} compact />
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL: Context Info ═══ */}
      <div className="clients-context">
        {selectedClient && !detailLoading && (
          <>
            {/* Case Completion */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">CASE COMPLETION</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
                <div style={{ position: 'relative', width: 60, height: 60 }}>
                  <svg viewBox="0 0 36 36" style={{ width: 60, height: 60, transform: 'rotate(-90deg)' }}>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none"
                      stroke={completion >= 75 ? '#10b981' : completion >= 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${completion * 0.975} 100`}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: completion >= 75 ? '#10b981' : completion >= 40 ? '#f59e0b' : '#ef4444',
                  }}>
                    {completion}%
                  </div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {completion >= 75 ? 'Almost complete' : completion >= 40 ? 'In progress' : 'Getting started'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    Based on docs, PIF & checklist
                  </div>
                </div>
              </div>
            </div>

            {/* Pipeline Stage */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">PIPELINE STAGE</div>
              <div style={{ marginTop: 4 }}>
                <span style={{
                  ...stageBadge(selectedClient.pipeline_stage),
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                }}>
                  {(PIPELINE_STAGES.find(p => p.id === selectedClient.pipeline_stage) || PIPELINE_STAGES[0]).label}
                </span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">CONTACT INFO</div>
              {selectedClient.phone && (
                <div className="clients-ctx-row">
                  <Phone size={14} color="var(--text-muted)" />
                  <span>{selectedClient.phone}</span>
                </div>
              )}
              {selectedClient.email && (
                <div className="clients-ctx-row">
                  <Mail size={14} color="var(--text-muted)" />
                  <span>{selectedClient.email}</span>
                </div>
              )}
              {selectedClient.visa_type && (
                <div className="clients-ctx-row">
                  <Briefcase size={14} color="var(--text-muted)" />
                  <span className="clients-tag" style={visaTagStyle(selectedClient.visa_type)}>
                    {selectedClient.visa_type}
                  </span>
                </div>
              )}
              {selectedClient.nationality && (
                <div className="clients-ctx-row">
                  <Globe size={14} color="var(--text-muted)" />
                  <span>{selectedClient.nationality}</span>
                </div>
              )}
              <div className="clients-ctx-row">
                <Calendar size={14} color="var(--text-muted)" />
                <span>Added {new Date(selectedClient.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">QUICK STATS</div>
              <div className="clients-ctx-stat-row">
                <span>Documents</span>
                <strong>{selectedClient.documents?.length || 0}</strong>
              </div>
              <div className="clients-ctx-stat-row">
                <span>Forms</span>
                <strong>{selectedClient.forms?.length || 0}</strong>
              </div>
              <div className="clients-ctx-stat-row">
                <span>Family Members</span>
                <strong>{selectedClient.family_members?.length || 0}</strong>
              </div>
              <div className="clients-ctx-stat-row">
                <span>Deadlines</span>
                <strong>{selectedClient.deadlines?.length || 0}</strong>
              </div>
              <div className="clients-ctx-stat-row">
                <span>PIF Status</span>
                <span className="clients-tag" style={{
                  ...pifBadgeStyle(selectedClient.pif_status),
                  fontSize: 11, fontWeight: 700, padding: '2px 8px',
                }}>
                  {(PIF_META[selectedClient.pif_status] || PIF_META.pending).label}
                </span>
              </div>
            </div>

            {/* Key Details */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">KEY DETAILS</div>
              {selectedClient.passport_number && (
                <div className="clients-ctx-stat-row">
                  <span>Passport</span>
                  <strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{selectedClient.passport_number}</strong>
                </div>
              )}
              {selectedClient.date_of_birth && (
                <div className="clients-ctx-stat-row">
                  <span>Date of Birth</span>
                  <strong>{selectedClient.date_of_birth}</strong>
                </div>
              )}
              <div className="clients-ctx-stat-row">
                <span>Account</span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600,
                  color: selectedClient.status === 'active' ? '#059669' : '#6b7280',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: selectedClient.status === 'active' ? '#10b981' : '#9ca3af',
                  }} />
                  {selectedClient.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="clients-ctx-section">
              <Link
                to={`/clients/${selectedClient.id}`}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Open Full File <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
