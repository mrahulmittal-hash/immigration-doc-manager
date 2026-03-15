import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STAGES = [
  { id: 'lead',       label: 'Lead',             color: '#656d76' },
  { id: 'consult',    label: 'Consultation',      color: '#3b82f6' },
  { id: 'retainer',   label: 'Retainer Signed',   color: '#8b5cf6' },
  { id: 'in_progress',label: 'In Progress',       color: '#f59e0b' },
  { id: 'submitted',  label: 'Submitted',         color: '#ec4899' },
  { id: 'approved',   label: 'Approved / Closed', color: '#10b981' },
];

function stageForClient(c) {
  if (c.status === 'inactive') return 'approved';
  if (c.pif_status === 'completed') return 'in_progress';
  if (c.pif_status === 'sent') return 'retainer';
  if (c.visa_type) return 'consult';
  return 'lead';
}

export default function Pipeline() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClients().then(setClients).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="page-title">Application Pipeline</div>
          <div className="page-subtitle">Track the lifecycle of every client case from lead to approval.</div>
        </div>
        <Link to="/clients/new" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none' }}>+ New Lead</Link>
      </div>

      <div className="pipeline-board">
        {STAGES.map((stage, idx) => {
          const stageClients = clients.filter(c => stageForClient(c) === stage.id);
          const progressPercent = ((idx + 1) / STAGES.length) * 100;
          
          return (
            <div key={stage.id} className="pipeline-col">
              <div className="pipeline-col-header">
                <div className="flex-center gap-8">
                  <div style={{ width:10, height:10, borderRadius:'50%', background:stage.color, boxShadow: `0 0 8px ${stage.color}` }} />
                  <span className="pipeline-col-title">{stage.label}</span>
                </div>
                <span className="pipeline-col-count">{stageClients.length}</span>
              </div>
              
              <div className="pipeline-cards">
                {stageClients.length === 0 && (
                  <div style={{ 
                    fontSize:13, color:'var(--text-muted)', textAlign:'center', 
                    padding:'32px 16px', border: '1px dashed rgba(255,255,255,0.1)', 
                    borderRadius: 8, marginTop: 8 
                  }}>
                    Drop clients here
                  </div>
                )}
                {stageClients.map(c => (
                  <Link to={`/clients/${c.id}`} key={c.id} className="pipeline-card" style={{ textDecoration:'none', display: 'block' }}>
                    <div className="pipeline-card-name">{c.first_name} {c.last_name}</div>
                    <div className="pipeline-card-meta">
                      {c.visa_type && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>🛂 {c.visa_type}</span>}
                      {c.nationality && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>🌍 {c.nationality}</span>}
                    </div>
                    <div className="pipeline-card-footer">
                      <span style={{ 
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: c.pif_status === 'completed' ? '#10b981' : c.pif_status === 'sent' ? '#3b82f6' : '#f59e0b' 
                      }}>
                        PIF: {c.pif_status || 'Pending'}
                      </span>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                        {new Date(c.created_at).toLocaleDateString('en-CA')}
                      </span>
                    </div>
                    {/* Stage Progress Indicator */}
                    <div className="pipeline-card-progress" style={{ width: `${progressPercent}%`, background: stage.color }} />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
