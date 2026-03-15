import { useState } from 'react';
import { Briefcase, Building2, User, Hash, Calendar, ChevronRight, Award } from 'lucide-react';

const LMIA_STAGES = [
  'draft', 'job_ad_posted', 'recruiting', 'application_prep',
  'submitted_esdc', 'additional_info', 'approved', 'refused', 'withdrawn',
];

const STAGE_LABELS = {
  draft: 'Draft',
  job_ad_posted: 'Job Ad Posted',
  recruiting: 'Recruiting',
  application_prep: 'App Prep',
  submitted_esdc: 'Submitted to ESDC',
  additional_info: "Add'l Info Requested",
  approved: 'Approved',
  refused: 'Refused',
  withdrawn: 'Withdrawn',
};

const STATUS_COLORS = {
  draft: '#656d76',
  job_ad_posted: '#3b82f6',
  recruiting: '#818cf8',
  application_prep: '#8b5cf6',
  submitted_esdc: '#f59e0b',
  additional_info: '#ec4899',
  approved: '#10b981',
  refused: '#ef4444',
  withdrawn: '#9ca3af',
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-CA');
}

function getNextStage(currentStatus) {
  const idx = LMIA_STAGES.indexOf(currentStatus);
  if (idx < 0 || idx >= LMIA_STAGES.length - 1) return null;
  // Don't advance past submitted_esdc into terminal states automatically
  if (currentStatus === 'additional_info') return null;
  if (currentStatus === 'approved' || currentStatus === 'refused' || currentStatus === 'withdrawn') return null;
  return LMIA_STAGES[idx + 1];
}

export default function LMIACard({ lmia, onStatusChange, compact }) {
  const [advancing, setAdvancing] = useState(false);
  const color = STATUS_COLORS[lmia.status] || '#656d76';
  const nextStage = getNextStage(lmia.status);
  const currentIdx = LMIA_STAGES.indexOf(lmia.status);

  const handleAdvance = async () => {
    if (!nextStage || !onStatusChange) return;
    setAdvancing(true);
    try {
      await onStatusChange(lmia.id, nextStage);
    } catch (err) {
      console.error('Failed to advance LMIA status:', err);
    }
    setAdvancing(false);
  };

  if (compact) {
    return (
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lmia.job_title || 'Untitled Position'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {lmia.employer_name || 'No employer'}
            </div>
          </div>
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
            background: `${color}18`, color, border: `1px solid ${color}33`, whiteSpace: 'nowrap',
          }}>
            {STAGE_LABELS[lmia.status] || lmia.status}
          </span>
        </div>
        {lmia.first_name && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <User size={10} /> {lmia.first_name} {lmia.last_name}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Briefcase size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                {lmia.job_title || 'Untitled Position'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginLeft: 26 }}>
              {lmia.employer_name && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Building2 size={12} /> {lmia.employer_name}
                </span>
              )}
              {lmia.noc_code && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Hash size={12} /> NOC {lmia.noc_code}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
              background: `${color}18`, color, border: `1px solid ${color}33`,
            }}>
              {STAGE_LABELS[lmia.status] || lmia.status}
            </span>
            {lmia.stream && (
              <span className="badge badge-gray" style={{ fontSize: 10 }}>
                {lmia.stream}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status stepper */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content' }}>
          {LMIA_STAGES.map((stage, i) => {
            const stageColor = STATUS_COLORS[stage];
            const isActive = stage === lmia.status;
            const isPast = currentIdx >= 0 && i < currentIdx;
            const isTerminal = stage === 'refused' || stage === 'withdrawn';
            const isApproved = stage === 'approved';

            // Skip refused/withdrawn dots unless that's the current status
            if ((isTerminal) && !isActive) return null;

            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && !(isTerminal && !isActive) && (
                  <div style={{
                    width: 20, height: 2,
                    background: isPast ? stageColor : 'var(--border)',
                  }} />
                )}
                <div
                  title={STAGE_LABELS[stage]}
                  style={{
                    width: isActive ? 14 : 8,
                    height: isActive ? 14 : 8,
                    borderRadius: '50%',
                    background: isActive ? stageColor : isPast ? stageColor : 'var(--border)',
                    border: isActive ? `2px solid ${stageColor}` : 'none',
                    boxShadow: isActive ? `0 0 0 3px ${stageColor}33` : 'none',
                    flexShrink: 0,
                    cursor: 'default',
                    transition: 'all 0.2s ease',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          Stage {currentIdx + 1} of {LMIA_STAGES.length}: {STAGE_LABELS[lmia.status]}
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {/* Wage info */}
        {(lmia.wage || lmia.wage_amount) && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>Wage:</span>{' '}
            {lmia.wage || `$${lmia.wage_amount}`}
            {lmia.wage_unit && ` / ${lmia.wage_unit}`}
          </div>
        )}

        {/* Client */}
        {lmia.first_name && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <User size={13} />
            <span style={{ fontWeight: 600 }}>Client:</span>{' '}
            {lmia.first_name} {lmia.last_name}
          </div>
        )}

        {/* LMIA number */}
        {lmia.lmia_number && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Award size={13} />
            <span style={{ fontWeight: 600 }}>LMIA #:</span>{' '}
            {lmia.lmia_number}
          </div>
        )}
      </div>

      {/* Dates */}
      {(lmia.submission_date || lmia.decision_date || lmia.expiry_date) && (
        <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {lmia.submission_date && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> Submitted: {formatDate(lmia.submission_date)}
            </div>
          )}
          {lmia.decision_date && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> Decision: {formatDate(lmia.decision_date)}
            </div>
          )}
          {lmia.expiry_date && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> Expires: {formatDate(lmia.expiry_date)}
            </div>
          )}
        </div>
      )}

      {/* Advance button */}
      {onStatusChange && nextStage && (
        <div style={{ padding: '0 20px 16px' }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            onClick={handleAdvance}
            disabled={advancing}
          >
            <ChevronRight size={14} />
            {advancing ? 'Advancing...' : `Advance to ${STAGE_LABELS[nextStage]}`}
          </button>
        </div>
      )}
    </div>
  );
}
