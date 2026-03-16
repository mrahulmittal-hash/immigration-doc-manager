import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';

export default function PortalStatus({ token }) {
  const [status, setStatus] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/portal/${token}/status`).then(r => r.json()),
      fetch(`/api/portal/${token}/timeline`).then(r => r.json()),
    ]).then(([statusData, timelineData]) => {
      setStatus(statusData);
      setTimeline(timelineData);
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;

  return (
    <div>
      {/* Stage Progress */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: 30,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 24
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', color: '#1a1a2e' }}>Application Progress</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {status?.stages?.map((stage, i) => {
            const isLast = i === status.stages.length - 1;
            return (
              <div key={stage.id} style={{ display: 'flex', gap: 16 }}>
                {/* Icon + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 32 }}>
                  {stage.completed ? (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <CheckCircle size={18} color="#fff" />
                    </div>
                  ) : stage.current ? (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: '#6366f1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.2)'
                    }}>
                      <Clock size={16} color="#fff" />
                    </div>
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', border: '2px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Circle size={14} color="#cbd5e1" />
                    </div>
                  )}
                  {!isLast && (
                    <div style={{
                      width: 2, height: 40, flexShrink: 0,
                      background: stage.completed ? '#10b981' : '#e2e8f0',
                    }} />
                  )}
                </div>
                {/* Label */}
                <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 20 }}>
                  <div style={{
                    fontSize: 15, fontWeight: stage.current ? 700 : 500,
                    color: stage.completed || stage.current ? '#1a1a2e' : '#94a3b8',
                  }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{stage.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {timeline.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 30,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#1a1a2e' }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {timeline.slice(0, 10).map(event => (
              <div key={event.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#f8fafc', borderRadius: 10
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a2e' }}>{event.title}</div>
                  {event.description && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{event.description}</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {new Date(event.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
