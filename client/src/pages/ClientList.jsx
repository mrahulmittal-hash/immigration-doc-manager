import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import CaseLifecycle from '../components/CaseLifecycle';
import NotesPanel from '../components/NotesPanel';
import {
  Search, Users, Trash2, CheckCircle, Mail, Clock, Globe, Plus,
  Phone, Pencil, Send, FileText, Key, PenTool, Calendar, ArrowRight,
  Briefcase, ChevronDown
} from 'lucide-react';

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

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pif, setPif] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const navigate = useNavigate();

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
    api.getClient(selectedId)
      .then(setSelectedClient)
      .catch(() => setSelectedClient(null))
      .finally(() => setDetailLoading(false));
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
                <span className="clients-item-badge" style={pifBadgeStyle(c.pif_status)}>
                  {c.pif_status === 'completed' ? 'Done' : c.pif_status === 'sent' ? 'Sent' : 'New'}
                </span>
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

      {/* ═══ CENTER PANEL: Client Detail + Lifecycle ═══ */}
      <div className="clients-center">
        {!selectedClient && !detailLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <Users size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>Select a client</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Choose a client from the list to view their case</div>
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
                  {selectedClient.notes && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.5, maxWidth: 600 }}>
                      {selectedClient.notes}
                    </div>
                  )}
                </div>
                <button className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                  onClick={() => navigate(`/clients/${selectedClient.id}`)}>
                  <Pencil size={13} /> Edit
                </button>
              </div>
            </div>

            {/* Immigration Case Lifecycle */}
            <div className="clients-detail-card">
              <CaseLifecycle client={selectedClient} />
            </div>

            {/* Communication / Notes */}
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
                <span>Data Fields</span>
                <strong>{selectedClient.client_data?.length || 0}</strong>
              </div>
              <div className="clients-ctx-stat-row">
                <span>Filled Forms</span>
                <strong>{selectedClient.filled_forms?.length || 0}</strong>
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
