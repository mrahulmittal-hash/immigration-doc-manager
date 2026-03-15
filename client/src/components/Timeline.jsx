import { useState, useEffect } from 'react';
import { api } from '../api';
import { FileText, PenTool, CheckCircle, ClipboardList, Upload, MessageSquare, Calendar, Filter, User } from 'lucide-react';

const EVENT_ICONS = {
  document_upload: { Icon: Upload, color: '#3b82f6', bg: 'rgba(59,130,246,.1)' },
  form_upload:     { Icon: PenTool, color: '#8b5cf6', bg: 'rgba(139,92,246,.1)' },
  form_filled:     { Icon: CheckCircle, color: '#10b981', bg: 'rgba(16,185,129,.1)' },
  pif_submitted:   { Icon: ClipboardList, color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
  note:            { Icon: MessageSquare, color: '#6366f1', bg: 'rgba(99,102,241,.1)' },
  status_change:   { Icon: User, color: '#ec4899', bg: 'rgba(236,72,153,.1)' },
  manual:          { Icon: Calendar, color: '#64748b', bg: 'rgba(100,116,139,.1)' },
};

const EVENT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'document_upload', label: 'Documents' },
  { key: 'form_upload', label: 'Forms' },
  { key: 'form_filled', label: 'Filled' },
  { key: 'pif_submitted', label: 'PIF' },
  { key: 'note', label: 'Notes' },
];

export default function Timeline({ clientId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getTimeline(clientId)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        {EVENT_FILTERS.map(f => (
          <button key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filter === f.key ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: filter === f.key ? 'var(--primary-glow)' : 'var(--bg-surface)',
              color: filter === f.key ? 'var(--primary)' : 'var(--text-secondary)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Calendar size={32} /></div>
            <div className="empty-title">No timeline events</div>
            <div className="empty-text">Activity will appear here as documents are uploaded, forms are filled, and notes are added.</div>
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 11, top: 8, bottom: 8, width: 2,
            background: 'var(--border)', borderRadius: 1
          }} />

          {filtered.map((ev, i) => {
            const meta = EVENT_ICONS[ev.event_type] || EVENT_ICONS.manual;
            const Icon = meta.Icon;
            const date = new Date(ev.created_at);

            return (
              <div key={`${ev.event_type}-${ev.id}-${i}`} style={{
                position: 'relative', marginBottom: 16, paddingLeft: 20
              }}>
                {/* Dot */}
                <div style={{
                  position: 'absolute', left: -22, top: 14, width: 24, height: 24,
                  borderRadius: '50%', background: meta.bg, border: `2px solid ${meta.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1
                }}>
                  <Icon size={12} color={meta.color} />
                </div>

                <div style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
                  borderRadius: 10, padding: '14px 18px',
                  transition: 'box-shadow 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {ev.title}
                      </div>
                      {ev.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                          {ev.description}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span style={{ marginLeft: 6 }}>{date.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  {ev.created_by && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      by {ev.created_by}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
