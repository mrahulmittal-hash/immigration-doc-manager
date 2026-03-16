import { Globe, Mail, Phone, FileText, Key, PenTool, CheckCircle, Calendar, Cake, BookOpen, Send, Link2, Pencil } from 'lucide-react';

const PIF_META = {
  pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: 'Pending' },
  sent:      { color: '#3b82f6', bg: 'rgba(59,130,246,.12)', label: 'Sent' },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,.12)', label: 'Completed' },
};

const PIPELINE_LABELS = {
  lead: 'Lead', consultation: 'Consultation', retainer_signed: 'Retainer Signed',
  in_progress: 'In Progress', submitted: 'Submitted', approved: 'Approved',
};
const PIPELINE_COLORS = {
  lead: '#656d76', consultation: '#3b82f6', retainer_signed: '#8b5cf6',
  in_progress: '#f59e0b', submitted: '#ec4899', approved: '#10b981',
};

export default function ClientContextPanel({ client, onSendPif, onSendPortal, onEdit }) {
  if (!client) return null;

  const pif = PIF_META[client.pif_status] || PIF_META.pending;
  const stage = client.pipeline_stage || 'lead';
  const stageColor = PIPELINE_COLORS[stage] || '#656d76';
  const stageLabel = PIPELINE_LABELS[stage] || stage;
  const docCount = client.documents?.length || 0;
  const formCount = client.forms?.length || 0;
  const filledCount = client.filled_forms?.length || 0;
  const dataCount = client.client_data?.length || 0;

  return (
    <div className="clients-context">
      {/* Contact Info */}
      <div className="clients-ctx-section">
        <div className="clients-ctx-label">Contact Info</div>
        {client.email && (
          <div className="clients-ctx-row">
            <Mail size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="clients-ctx-row">
            <Phone size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{client.phone}</span>
          </div>
        )}
        {client.nationality && (
          <div className="clients-ctx-row">
            <Globe size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{client.nationality}</span>
          </div>
        )}
        {client.date_of_birth && (
          <div className="clients-ctx-row">
            <Cake size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{client.date_of_birth}</span>
          </div>
        )}
        {client.passport_number && (
          <div className="clients-ctx-row">
            <BookOpen size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{client.passport_number}</span>
          </div>
        )}
      </div>

      {/* Pipeline Stage */}
      <div className="clients-ctx-section">
        <div className="clients-ctx-label">Pipeline Stage</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 20,
          background: `${stageColor}14`, color: stageColor,
          fontSize: 13, fontWeight: 700,
          border: `1px solid ${stageColor}33`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: stageColor }} />
          {stageLabel}
        </div>

        {/* PIF Status */}
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 16,
            background: pif.bg, color: pif.color,
            fontSize: 12, fontWeight: 700,
            border: `1px solid ${pif.color}33`,
          }}>
            PIF: {pif.label}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="clients-ctx-section">
        <div className="clients-ctx-label">Quick Stats</div>
        {[
          { icon: FileText, label: 'Documents', val: docCount },
          { icon: PenTool, label: 'Forms', val: formCount },
          { icon: Key, label: 'Data Fields', val: dataCount },
          { icon: CheckCircle, label: 'Filled Forms', val: filledCount },
        ].map(s => (
          <div key={s.label} className="clients-ctx-stat-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <s.icon size={14} style={{ color: 'var(--text-muted)' }} />
              {s.label}
            </span>
            <strong>{s.val}</strong>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="clients-ctx-section">
        <div className="clients-ctx-label">Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onSendPif && (
            <button
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
              onClick={onSendPif}
              disabled={!client.email}
            >
              <Send size={13} /> Send PIF Form
            </button>
          )}
          {onSendPortal && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
              onClick={onSendPortal}
              disabled={!client.email}
            >
              <Link2 size={13} /> Portal Link
            </button>
          )}
          {onEdit && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
              onClick={onEdit}
            >
              <Pencil size={13} /> Edit Client
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
