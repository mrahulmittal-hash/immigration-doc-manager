import { useState } from 'react';
import { CheckCircle, Circle, DollarSign, ArrowRight } from 'lucide-react';

const STAGE_LABELS = {
  consultation: 'Consultation',
  retainer_signed: 'Retainer Signed',
  in_progress: 'Documents & Prep',
  submitted: 'Submitted',
  approved: 'Approved',
};

export default function MilestoneTracker({ milestones, onRelease, totalRetainer }) {
  const [releasing, setReleasing] = useState(null);

  const handleRelease = async (milestoneId) => {
    setReleasing(milestoneId);
    try {
      await onRelease(milestoneId);
    } finally {
      setReleasing(null);
    }
  };

  if (!milestones || milestones.length === 0) return null;

  const totalReleased = milestones.filter(m => m.status === 'released').reduce((s, m) => s + parseFloat(m.amount), 0);
  const totalPending = milestones.filter(m => m.status === 'pending').reduce((s, m) => s + parseFloat(m.amount), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Milestone Releases</h4>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Released: <span style={{ color: '#10b981', fontWeight: 600 }}>${totalReleased.toFixed(2)}</span>
          {' / '}
          Pending: <span style={{ color: '#f59e0b', fontWeight: 600 }}>${totalPending.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {milestones.map((m, i) => {
          const released = m.status === 'released';
          return (
            <div key={m.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px',
              background: released ? 'rgba(16,185,129,0.05)' : 'var(--bg-elevated)',
              border: `1px solid ${released ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {released ? (
                  <CheckCircle size={18} color="#10b981" />
                ) : (
                  <Circle size={18} color="#94a3b8" />
                )}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {STAGE_LABELS[m.pipeline_stage] || m.pipeline_stage}
                  </div>
                  {m.percentage > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {parseFloat(m.percentage).toFixed(0)}% of retainer
                    </div>
                  )}
                  {released && m.released_at && (
                    <div style={{ fontSize: 11, color: '#10b981' }}>
                      Released {new Date(m.released_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: released ? '#10b981' : 'var(--text-primary)' }}>
                  ${parseFloat(m.amount).toFixed(2)}
                </span>
                {!released && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleRelease(m.id)}
                    disabled={releasing === m.id}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                  >
                    {releasing === m.id ? '...' : (
                      <>
                        <ArrowRight size={12} /> Release
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
