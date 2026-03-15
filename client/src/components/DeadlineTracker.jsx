import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { CalendarClock, Plus, Trash2, CheckCircle, AlertTriangle, Clock, X } from 'lucide-react';

const CATEGORIES = [
  { value: 'filing', label: 'Filing' },
  { value: 'biometrics', label: 'Biometrics' },
  { value: 'medical', label: 'Medical' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'payment', label: 'Payment' },
  { value: 'other', label: 'Other' },
];

function getUrgencyColor(deadlineDate) {
  const now = new Date();
  const deadline = new Date(deadlineDate);
  const diffMs = deadline - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { color: '#991b1b', bg: '#fef2f2', border: '#fecaca', label: 'Overdue' };
  if (diffDays < 7) return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: `${diffDays}d left` };
  if (diffDays < 30) return { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: `${diffDays}d left` };
  return { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: `${diffDays}d left` };
}

export default function DeadlineTracker({ clientId }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', deadline_date: '', category: 'filing', notes: '' });

  const fetchDeadlines = useCallback(async () => {
    try {
      const data = await api.getDeadlines(clientId);
      setDeadlines(data);
    } catch (err) {
      console.error('Failed to fetch deadlines:', err);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title || !form.deadline_date) return;
    try {
      await api.addDeadline(clientId, form);
      setForm({ title: '', deadline_date: '', category: 'filing', notes: '' });
      setShowForm(false);
      fetchDeadlines();
    } catch (err) {
      console.error('Failed to add deadline:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this deadline?')) return;
    try {
      await api.deleteDeadline(id);
      fetchDeadlines();
    } catch (err) {
      console.error('Failed to delete deadline:', err);
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.updateDeadline(id, { status: 'completed' });
      fetchDeadlines();
    } catch (err) {
      console.error('Failed to complete deadline:', err);
    }
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Track important dates: filing deadlines, biometrics appointments, medical exams, and more.
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowForm(s => !s)}>
          {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Deadline</>}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <form onSubmit={handleAdd}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" placeholder="e.g. Biometrics Appointment"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Deadline Date</label>
                <input type="date" className="form-input"
                  value={form.deadline_date} onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-textarea" rows={2} placeholder="Additional details..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Add Deadline
              </button>
            </div>
          </form>
        </div>
      )}

      {deadlines.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><CalendarClock size={32} /></div>
            <div className="empty-title">No deadlines set</div>
            <div className="empty-text">Add important dates to track filing deadlines, appointments, and more.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          {deadlines.map(d => {
            const urgency = getUrgencyColor(d.deadline_date);
            const isCompleted = d.status === 'completed';
            return (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderBottom: '1px solid var(--border)',
                opacity: isCompleted ? 0.5 : 1,
                background: isCompleted ? 'transparent' : urgency.bg,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCompleted ? 'rgba(16,185,129,.12)' : `${urgency.color}18`,
                    color: isCompleted ? '#10b981' : urgency.color,
                    border: `1px solid ${isCompleted ? '#10b98133' : urgency.border}`,
                  }}>
                    {isCompleted ? <CheckCircle size={18} /> : d.deadline_date && new Date(d.deadline_date) < new Date() ? <AlertTriangle size={18} /> : <Clock size={18} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, textDecoration: isCompleted ? 'line-through' : 'none' }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span>{new Date(d.deadline_date).toLocaleDateString('en-CA')}</span>
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>{d.category}</span>
                      {!isCompleted && (
                        <span style={{ fontWeight: 700, color: urgency.color, fontSize: 11 }}>{urgency.label}</span>
                      )}
                    </div>
                    {d.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{d.notes}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!isCompleted && (
                    <button className="btn btn-success btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => handleComplete(d.id)}>
                      <CheckCircle size={12} /> Done
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center' }}
                    onClick={() => handleDelete(d.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
