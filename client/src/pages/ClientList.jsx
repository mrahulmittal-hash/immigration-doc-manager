import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import ClientDetailCenter from '../components/ClientDetailCenter';
import ClientContextPanel from '../components/ClientContextPanel';
import { Search, Users, Plus, Globe } from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'all',              label: 'All' },
  { id: 'lead',             label: 'Lead' },
  { id: 'consultation',     label: 'Consultation' },
  { id: 'retainer_signed',  label: 'Retainer' },
  { id: 'in_progress',      label: 'In Progress' },
  { id: 'submitted',        label: 'Submitted' },
  { id: 'approved',         label: 'Approved' },
];

const STAGE_COLORS = {
  lead: '#656d76', consultation: '#3b82f6', retainer_signed: '#8b5cf6',
  in_progress: '#f59e0b', submitted: '#ec4899', approved: '#10b981',
};

export default function ClientList() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(routeId ? Number(routeId) : null);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    api.getClients().then(setClients).finally(() => setLoading(false));
  }, []);

  // Sync route param
  useEffect(() => {
    if (routeId) setSelectedId(Number(routeId));
  }, [routeId]);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    if (q && !name.includes(q) && !(c.email||'').toLowerCase().includes(q) && !(c.nationality||'').toLowerCase().includes(q)) return false;
    if (stageFilter !== 'all' && (c.pipeline_stage || 'lead') !== stageFilter) return false;
    return true;
  });

  const handleSelectClient = (cId) => {
    setSelectedId(cId);
    navigate(`/clients/${cId}`, { replace: true });
  };

  const handleClientUpdated = (data) => {
    setSelectedClient(data);
    // Update sidebar list too
    setClients(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
  };

  return (
    <div className="clients-3panel">
      {/* ── Left Sidebar ── */}
      <div className="clients-sidebar">
        <Link to="/clients/new" className="clients-add-btn">
          <Plus size={16} /> Add Client
        </Link>

        {/* Search */}
        <div className="clients-search-wrap">
          <span className="clients-search-icon"><Search size={14} /></span>
          <input
            className="clients-search-input"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Stage filter chips */}
        <div style={{ display: 'flex', gap: 6, padding: '4px 12px 8px', flexWrap: 'wrap' }}>
          {PIPELINE_STAGES.map(s => (
            <button
              key={s.id}
              className={`clients-filter-chip ${stageFilter === s.id ? 'active' : ''}`}
              onClick={() => setStageFilter(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Client list */}
        <div className="clients-list">
          {loading && (
            <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" /></div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No clients found
            </div>
          )}
          {filtered.map(c => {
            const isActive = c.id === selectedId;
            const stage = c.pipeline_stage || 'lead';
            const stageColor = STAGE_COLORS[stage] || '#656d76';
            return (
              <div
                key={c.id}
                className={`clients-list-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectClient(c.id)}
              >
                <div className="clients-item-avatar">
                  {c.first_name?.[0]}{c.last_name?.[0]}
                </div>
                <div className="clients-item-info">
                  <div className="clients-item-name">{c.first_name} {c.last_name}</div>
                  <div className="clients-item-meta">
                    {c.email || c.nationality || 'No contact info'}
                  </div>
                </div>
                <span className="clients-item-badge" style={{
                  background: `${stageColor}18`,
                  color: stageColor,
                  border: `1px solid ${stageColor}33`,
                }}>
                  {PIPELINE_STAGES.find(s => s.id === stage)?.label || stage}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer count */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--border)',
          fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{filtered.length} clients</span>
          <span>{clients.length} total</span>
        </div>
      </div>

      {/* ── Center Panel ── */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {!selectedId ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', color: 'var(--text-muted)',
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: 20,
                background: 'linear-gradient(135deg, rgba(13,148,136,.1), rgba(15,118,110,.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Users size={36} style={{ color: '#0d9488' }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                Select a Client
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 300, textAlign: 'center', lineHeight: 1.5 }}>
                Choose a client from the sidebar to view their full case details, workflow stages, and documents.
              </div>
            </div>
          ) : (
            <ClientDetailCenter
              key={selectedId}
              clientId={selectedId}
              onClientUpdated={handleClientUpdated}
            />
          )}
        </div>
      </div>

      {/* ── Right Context Panel ── */}
      {selectedId && selectedClient && (
        <ClientContextPanel client={selectedClient} />
      )}
    </div>
  );
}
