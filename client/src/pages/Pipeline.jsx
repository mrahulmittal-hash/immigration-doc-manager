import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Stamp, Globe } from 'lucide-react';

const STAGES = [
  { id: 'lead',            label: 'Lead',             color: '#656d76' },
  { id: 'consultation',    label: 'Consultation',     color: '#3b82f6' },
  { id: 'retainer_signed', label: 'Retainer Signed',  color: '#8b5cf6' },
  { id: 'in_progress',     label: 'In Progress',      color: '#f59e0b' },
  { id: 'submitted',       label: 'Submitted',        color: '#ec4899' },
  { id: 'approved',        label: 'Approved',         color: '#10b981' },
];

export default function Pipeline() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedClient, setDraggedClient] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const fetchClients = useCallback(() => {
    api.getClients().then(setClients).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const getClientsByStage = (stageId) => {
    return clients.filter(c => (c.pipeline_stage || 'lead') === stageId);
  };

  const handleDragStart = (e, client) => {
    setDraggedClient(client);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', client.id.toString());
    // Make the drag image slightly transparent
    if (e.target) {
      e.target.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e) => {
    if (e.target) {
      e.target.style.opacity = '1';
    }
    setDraggedClient(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = (e) => {
    // Only clear if leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedClient) return;
    const currentStage = draggedClient.pipeline_stage || 'lead';
    if (currentStage === stageId) return;

    // Optimistic update
    setClients(prev => prev.map(c =>
      c.id === draggedClient.id ? { ...c, pipeline_stage: stageId } : c
    ));

    try {
      await api.updateClientStage(draggedClient.id, stageId);
    } catch (err) {
      console.error('Failed to update stage:', err);
      // Revert on failure
      setClients(prev => prev.map(c =>
        c.id === draggedClient.id ? { ...c, pipeline_stage: currentStage } : c
      ));
    }

    setDraggedClient(null);
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="page-title">Application Pipeline</div>
          <div className="page-subtitle">Drag and drop clients between stages to update their progress.</div>
        </div>
        <Link to="/clients/new" className="btn btn-primary">+ New Lead</Link>
      </div>

      <div className="pipeline-board">
        {STAGES.map((stage, idx) => {
          const stageClients = getClientsByStage(stage.id);
          const isOver = dragOverStage === stage.id;
          const progressPercent = ((idx + 1) / STAGES.length) * 100;

          return (
            <div key={stage.id} className="pipeline-col"
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
                <span className="pipeline-col-count">{stageClients.length}</span>
              </div>

              <div className="pipeline-cards" style={{ minHeight: 80 }}>
                {stageClients.length === 0 && (
                  <div style={{
                    fontSize: 13, color: 'var(--text-muted)', textAlign: 'center',
                    padding: '32px 16px', border: `1px dashed ${isOver ? stage.color : 'var(--border)'}`,
                    borderRadius: 8, marginTop: 8,
                    background: isOver ? `${stage.color}08` : 'transparent',
                  }}>
                    Drop clients here
                  </div>
                )}
                {stageClients.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, c)}
                    onDragEnd={handleDragEnd}
                    className="pipeline-card"
                    style={{
                      cursor: 'grab', userSelect: 'none',
                      opacity: draggedClient?.id === c.id ? 0.5 : 1,
                    }}
                  >
                    <Link to={`/clients/${c.id}`} style={{ textDecoration: 'none', display: 'block' }}
                      onClick={(e) => { if (draggedClient) e.preventDefault(); }}>
                      <div className="pipeline-card-name">{c.first_name} {c.last_name}</div>
                      <div className="pipeline-card-meta">
                        {c.visa_type && <span style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Stamp size={12} /> {c.visa_type}</span>}
                        {c.nationality && <span style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Globe size={12} /> {c.nationality}</span>}
                      </div>
                      <div className="pipeline-card-footer">
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          color: c.pif_status === 'completed' ? '#10b981' : c.pif_status === 'sent' ? '#3b82f6' : '#f59e0b'
                        }}>
                          PIF: {c.pif_status || 'Pending'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(c.created_at).toLocaleDateString('en-CA')}
                        </span>
                      </div>
                      <div className="pipeline-card-progress" style={{ width: `${progressPercent}%`, background: stage.color }} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
