import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { ListChecks, CheckCircle, AlertCircle, MinusCircle, RefreshCw } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'missing', label: 'Missing', color: '#dc2626', bg: '#fef2f2' },
  { value: 'uploaded', label: 'Uploaded', color: '#16a34a', bg: '#f0fdf4' },
  { value: 'waived', label: 'Waived', color: '#6b7280', bg: '#f9fafb' },
];

function getStatusMeta(status) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

export default function DocumentChecklist({ clientId, visaType }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  const fetchChecklist = useCallback(async () => {
    try {
      const data = await api.getClientChecklist(clientId);
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch checklist:', err);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  const handleInit = async () => {
    setInitializing(true);
    try {
      await api.initClientChecklist(clientId);
      await fetchChecklist();
    } catch (err) {
      console.error('Failed to initialize checklist:', err);
    }
    setInitializing(false);
  };

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      await api.updateChecklistItem(itemId, { status: newStatus });
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: newStatus } : item
      ));
    } catch (err) {
      console.error('Failed to update checklist item:', err);
    }
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  // Not initialized yet
  if (items.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon"><ListChecks size={32} /></div>
          <div className="empty-title">No checklist initialized</div>
          <div className="empty-text">
            {visaType
              ? `Initialize the document checklist for "${visaType}" to track required documents.`
              : 'Set a visa type for this client first, then initialize their document checklist.'}
          </div>
          {visaType && (
            <button className="btn btn-primary" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, margin: '16px auto 0' }}
              onClick={handleInit} disabled={initializing}>
              <RefreshCw size={14} className={initializing ? 'spinning' : ''} />
              {initializing ? 'Initializing...' : 'Initialize Checklist'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Calculate progress
  const total = items.length;
  const completed = items.filter(i => i.status === 'uploaded' || i.status === 'waived').length;
  const required = items.filter(i => i.is_required);
  const requiredComplete = required.filter(i => i.status === 'uploaded' || i.status === 'waived').length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Group items by category
  const grouped = {};
  items.forEach(item => {
    const cat = item.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  return (
    <div>
      {/* Progress bar */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListChecks size={18} /> Document Checklist Progress
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {completed}/{total} items ({progressPercent}%) &middot; {requiredComplete}/{required.length} required
          </div>
        </div>
        <div style={{
          width: '100%', height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden'
        }}>
          <div style={{
            width: `${progressPercent}%`, height: '100%', borderRadius: 5,
            background: progressPercent === 100 ? '#16a34a' : progressPercent > 50 ? '#3b82f6' : '#f59e0b',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Checklist items grouped by category */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title" style={{ textTransform: 'capitalize' }}>{category}</div>
            <span className="badge badge-gray">
              {catItems.filter(i => i.status === 'uploaded' || i.status === 'waived').length}/{catItems.length}
            </span>
          </div>
          {catItems.map(item => {
            const statusMeta = getStatusMeta(item.status);
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${statusMeta.color}14`, color: statusMeta.color,
                  }}>
                    {item.status === 'uploaded' ? <CheckCircle size={16} /> :
                     item.status === 'waived' ? <MinusCircle size={16} /> :
                     <AlertCircle size={16} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.document_name}
                      <span className={`badge ${item.is_required ? 'badge-danger' : 'badge-gray'}`}
                        style={{ fontSize: 9, padding: '1px 6px' }}>
                        {item.is_required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
                <select
                  value={item.status}
                  onChange={e => handleStatusChange(item.id, e.target.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${statusMeta.color}44`, background: statusMeta.bg,
                    color: statusMeta.color, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
