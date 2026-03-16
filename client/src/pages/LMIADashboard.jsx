import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import LMIACard from '../components/LMIACard';
import { Briefcase, CheckCircle, Clock, FileText, X } from 'lucide-react';

const STAGES = [
  { id: 'draft',            label: 'Draft',        color: '#656d76' },
  { id: 'job_ad_posted',    label: 'Job Ad Posted', color: '#3b82f6' },
  { id: 'recruiting',       label: 'Recruiting',   color: '#818cf8' },
  { id: 'application_prep', label: 'App Prep',     color: '#8b5cf6' },
  { id: 'submitted_esdc',   label: 'Submitted',    color: '#f59e0b' },
  { id: 'additional_info',  label: "Add'l Info",   color: '#ec4899' },
  { id: 'approved',         label: 'Approved',     color: '#10b981' },
  { id: 'refused',          label: 'Refused',      color: '#ef4444' },
  { id: 'withdrawn',        label: 'Withdrawn',    color: '#9ca3af' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));

const STREAMS = [
  'High-Wage', 'Low-Wage', 'Global Talent', 'Agriculture',
  'Caregiver', 'Francophone', 'Other',
];

export default function LMIADashboard() {
  const [lmias, setLmias] = useState([]);
  const [employers, setEmployers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [draggedLmia, setDraggedLmia] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // Filters
  const [filterEmployer, setFilterEmployer] = useState('');
  const [filterStream, setFilterStream] = useState('');

  // New LMIA modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    employer_id: '', client_id: '', job_title: '', noc_code: '',
    teer_category: '', wage_offered: '', wage_type: 'hourly',
    work_location: '', num_positions: '1', stream: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [lmiaData, empData, clientData, statsData] = await Promise.all([
        api.getLMIAs(),
        api.getEmployers(),
        api.getClients(),
        api.getLMIAStats().catch(() => ({})),
      ]);
      setLmias(lmiaData);
      setEmployers(empData);
      setClients(clientData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load LMIA data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Filtered LMIAs
  const filteredLmias = lmias.filter(l => {
    if (filterEmployer && String(l.employer_id) !== filterEmployer) return false;
    if (filterStream && l.stream !== filterStream) return false;
    return true;
  });

  const getLmiasByStage = (stageId) => filteredLmias.filter(l => (l.status || 'draft') === stageId);

  // Computed stats
  const totalLmias = lmias.length;
  const activeLmias = lmias.filter(l => !['approved', 'refused', 'withdrawn'].includes(l.status)).length;
  const approvedLmias = lmias.filter(l => l.status === 'approved').length;
  const pendingJobAds = lmias.filter(l => l.status === 'job_ad_posted').length;

  // ── Drag & Drop ────────────────────────────────────────
  const handleDragStart = (e, lmia) => {
    setDraggedLmia(lmia);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lmia.id.toString());
    if (e.target) e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setDraggedLmia(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedLmia) return;
    const currentStatus = draggedLmia.status || 'draft';
    if (currentStatus === stageId) return;

    // Optimistic update
    setLmias(prev => prev.map(l =>
      l.id === draggedLmia.id ? { ...l, status: stageId } : l
    ));

    try {
      await api.updateLMIAStatus(draggedLmia.id, stageId);
    } catch (err) {
      console.error('Failed to update LMIA status:', err);
      setLmias(prev => prev.map(l =>
        l.id === draggedLmia.id ? { ...l, status: currentStatus } : l
      ));
    }
    setDraggedLmia(null);
  };

  // Status change from LMIACard advance button
  const handleStatusChange = async (id, newStatus) => {
    const old = lmias.find(l => l.id === id);
    if (!old) return;
    setLmias(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    try {
      await api.updateLMIAStatus(id, newStatus);
    } catch (err) {
      console.error('Failed to update status:', err);
      setLmias(prev => prev.map(l => l.id === id ? { ...l, status: old.status } : l));
    }
  };

  // ── Create LMIA ────────────────────────────────────────
  const handleCreate = async () => {
    if (!newForm.employer_id) return;
    setCreating(true);
    try {
      const payload = {
        employer_id: parseInt(newForm.employer_id),
        client_id: newForm.client_id ? parseInt(newForm.client_id) : null,
        job_title: newForm.job_title,
        noc_code: newForm.noc_code,
        teer_category: newForm.teer_category,
        wage_offered: newForm.wage_offered ? parseFloat(newForm.wage_offered) : null,
        wage_type: newForm.wage_type,
        work_location: newForm.work_location,
        num_positions: parseInt(newForm.num_positions) || 1,
        stream: newForm.stream,
        status: 'draft',
      };
      await api.createLMIA(payload);
      setShowNew(false);
      setNewForm({
        employer_id: '', client_id: '', job_title: '', noc_code: '',
        teer_category: '', wage_offered: '', wage_type: 'hourly',
        work_location: '', num_positions: '1', stream: '',
      });
      fetchAll();
    } catch (err) {
      console.error('Failed to create LMIA:', err);
    } finally {
      setCreating(false);
    }
  };

  function fmt(n) { return n?.toLocaleString('en-CA') ?? '0'; }

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="page-title">LMIA Tracker</div>
          <div className="page-subtitle">Drag and drop LMIAs between stages to update their status.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New LMIA</button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ flexShrink: 0 }}>
        <div className="stat-card blue">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Briefcase size={22} /></div>
          <div className="stat-value">{fmt(totalLmias)}</div>
          <div className="stat-label">Total LMIAs</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={22} /></div>
          <div className="stat-value">{fmt(activeLmias)}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={22} /></div>
          <div className="stat-value">{fmt(approvedLmias)}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={22} /></div>
          <div className="stat-value">{fmt(pendingJobAds)}</div>
          <div className="stat-label">Pending Job Ads</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, padding: '0 0 16px', flexShrink: 0, flexWrap: 'wrap' }}>
        <select
          className="form-input"
          style={{ width: 200, padding: '6px 10px', fontSize: 13 }}
          value={filterEmployer}
          onChange={e => setFilterEmployer(e.target.value)}
        >
          <option value="">All Employers</option>
          {employers.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.company_name}</option>
          ))}
        </select>
        <select
          className="form-input"
          style={{ width: 180, padding: '6px 10px', fontSize: 13 }}
          value={filterStream}
          onChange={e => setFilterStream(e.target.value)}
        >
          <option value="">All Streams</option>
          {STREAMS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="pipeline-board">
        {STAGES.map(stage => {
          const stageLmias = getLmiasByStage(stage.id);
          const isOver = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              className="pipeline-col"
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
              style={{
                transition: 'background 0.15s ease, box-shadow 0.15s ease',
                background: isOver ? `${stage.color}10` : undefined,
                boxShadow: isOver ? `inset 0 0 0 2px ${stage.color}44` : undefined,
                borderRadius: isOver ? 8 : undefined,
              }}
            >
              <div className="pipeline-col-header" style={{ borderTop: `3px solid ${stage.color}` }}>
                <div className="flex-center gap-8">
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color }} />
                  <span className="pipeline-col-title">{stage.label}</span>
                </div>
                <span className="pipeline-col-count">{stageLmias.length}</span>
              </div>

              <div className="pipeline-cards" style={{ minHeight: 80 }}>
                {stageLmias.length === 0 && (
                  <div style={{
                    fontSize: 13, color: 'var(--text-muted)', textAlign: 'center',
                    padding: '32px 16px', border: `1px dashed ${isOver ? stage.color : 'var(--border)'}`,
                    borderRadius: 8, marginTop: 8,
                    background: isOver ? `${stage.color}08` : 'transparent',
                  }}>
                    Drop LMIAs here
                  </div>
                )}
                {stageLmias.map(lmia => (
                  <div
                    key={lmia.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lmia)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: 'grab',
                      userSelect: 'none',
                      opacity: draggedLmia?.id === lmia.id ? 0.5 : 1,
                    }}
                  >
                    <LMIACard lmia={lmia} compact onStatusChange={handleStatusChange} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* New LMIA Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">New LMIA Application</div>
              <button className="modal-close" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Employer *</label>
                <select className="form-input" value={newForm.employer_id} onChange={e => setNewForm({ ...newForm, employer_id: e.target.value })}>
                  <option value="">Select employer...</option>
                  {employers.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Client (optional)</label>
                <select className="form-input" value={newForm.client_id} onChange={e => setNewForm({ ...newForm, client_id: e.target.value })}>
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Job Title</label>
                <input className="form-input" placeholder="e.g. Software Developer" value={newForm.job_title} onChange={e => setNewForm({ ...newForm, job_title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">NOC Code</label>
                <input className="form-input" placeholder="e.g. 21232" value={newForm.noc_code} onChange={e => setNewForm({ ...newForm, noc_code: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">TEER Category</label>
                <select className="form-input" value={newForm.teer_category} onChange={e => setNewForm({ ...newForm, teer_category: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="0">TEER 0</option>
                  <option value="1">TEER 1</option>
                  <option value="2">TEER 2</option>
                  <option value="3">TEER 3</option>
                  <option value="4">TEER 4</option>
                  <option value="5">TEER 5</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Wage Offered</label>
                <input type="number" className="form-input" placeholder="25.00" value={newForm.wage_offered} onChange={e => setNewForm({ ...newForm, wage_offered: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Wage Type</label>
                <select className="form-input" value={newForm.wage_type} onChange={e => setNewForm({ ...newForm, wage_type: e.target.value })}>
                  <option value="hourly">Hourly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Work Location</label>
                <input className="form-input" placeholder="City, Province" value={newForm.work_location} onChange={e => setNewForm({ ...newForm, work_location: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label"># of Positions</label>
                <input type="number" className="form-input" min="1" value={newForm.num_positions} onChange={e => setNewForm({ ...newForm, num_positions: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Stream</label>
                <select className="form-input" value={newForm.stream} onChange={e => setNewForm({ ...newForm, stream: e.target.value })}>
                  <option value="">Select stream...</option>
                  {STREAMS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newForm.employer_id}>
                {creating ? 'Creating...' : 'Create LMIA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
