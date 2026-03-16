import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { CheckCircle, Circle, FolderOpen, Calendar, Trash2, Check, X, Loader, Plus, CalendarClock, AlertTriangle } from 'lucide-react';

const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['PIF', 'Document Review', 'Form Filing', 'Client Follow-up', 'IRCC Submission', 'Other'];
const DEADLINE_CATEGORIES = ['filing', 'biometrics', 'medical', 'consultation', 'payment', 'permit_expiry', 'express_entry', 'pnp', 'submission', 'landing', 'other'];
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

function getDaysRemaining(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getUrgencyColor(days) {
  if (days < 0) return '#ef4444';
  if (days <= 7) return '#ef4444';
  if (days <= 30) return '#f59e0b';
  return '#10b981';
}

export default function TaskPanel({ clientId }) {
  const [tasks, setTasks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showNewDeadline, setShowNewDeadline] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', category: 'Other', due_date: '' });
  const [newDeadline, setNewDeadline] = useState({ title: '', deadline_date: '', category: 'filing', notes: '' });

  const fetchAll = useCallback(async () => {
    try {
      const [taskData, deadlineData] = await Promise.all([
        api.getTasks(filter === 'deadlines' ? '' : filter, '', clientId),
        api.getDeadlines(clientId),
      ]);
      setTasks(taskData);
      setDeadlines(deadlineData);
    } catch (e) { console.error('Failed to load:', e); }
    setLoading(false);
  }, [filter, clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function toggle(id) {
    try { await api.toggleTask(id); fetchAll(); } catch (e) { console.error('Toggle failed:', e); }
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    try {
      await api.createTask({ ...newTask, client_id: clientId });
      setNewTask({ title: '', priority: 'medium', category: 'Other', due_date: '' });
      setShowNew(false);
      fetchAll();
    } catch (e) { console.error('Create failed:', e); }
  }

  async function addDeadline() {
    if (!newDeadline.title.trim() || !newDeadline.deadline_date) return;
    try {
      await api.addDeadline(clientId, newDeadline);
      setNewDeadline({ title: '', deadline_date: '', category: 'filing', notes: '' });
      setShowNewDeadline(false);
      fetchAll();
    } catch (e) { console.error('Create deadline failed:', e); }
  }

  async function deleteTask(id) {
    try { await api.deleteTask(id); fetchAll(); } catch (e) { console.error('Delete failed:', e); }
  }

  async function completeDeadline(id) {
    try { await api.updateDeadline(id, { status: 'completed' }); fetchAll(); } catch (e) { console.error('Complete deadline failed:', e); }
  }

  async function deleteDeadline(id) {
    try { await api.deleteDeadline(id); fetchAll(); } catch (e) { console.error('Delete deadline failed:', e); }
  }

  // Build unified list
  const deadlineItems = (filter !== 'todo' && filter !== 'done') ? deadlines.filter(d => d.status === 'pending').map(d => {
    const days = getDaysRemaining(d.deadline_date);
    return {
      id: `deadline-${d.id}`,
      deadlineId: d.id,
      title: d.title,
      priority: days <= 7 ? 'high' : days <= 30 ? 'medium' : 'low',
      category: d.category,
      due_date: d.deadline_date,
      done: false,
      isDeadline: true,
      notes: d.notes,
      daysRemaining: days,
    };
  }) : [];

  const filteredTasks = filter === 'deadlines' ? [] : tasks;
  const allItems = filter === 'deadlines' ? deadlineItems : [...filteredTasks, ...deadlineItems];
  // Sort: undone first, then by due date
  allItems.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
    if (a.due_date) return -1;
    return 1;
  });

  const todo = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;
  const pendingDeadlines = deadlines.filter(d => d.status === 'pending').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader size={24} className="spin" style={{ color: 'var(--accent-teal)' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{todo} tasks, {pendingDeadlines} deadlines</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ v: '', l: 'All' }, { v: 'todo', l: 'To Do' }, { v: 'done', l: 'Done' }, { v: 'deadlines', l: 'Deadlines' }].map(f => (
              <button key={f.v} className={`filter-pill ${filter === f.v ? 'active' : ''}`} onClick={() => setFilter(f.v)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowNew(true); setShowNewDeadline(false); }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={14} /> Task
          </button>
          <button className="btn btn-sm" onClick={() => { setShowNewDeadline(true); setShowNew(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' }}>
            <CalendarClock size={14} /> Deadline
          </button>
        </div>
      </div>

      {/* New Task Form */}
      {showNew && (
        <div className="card" style={{ padding: 14, marginBottom: 12, background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="form-input" placeholder="Task title..." value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addTask()} />
            <button className="btn btn-primary btn-sm" onClick={addTask}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-select" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="form-select" value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="form-input" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }} />
          </div>
        </div>
      )}

      {/* New Deadline Form */}
      {showNewDeadline && (
        <div className="card" style={{ padding: 14, marginBottom: 12, background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.2)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="form-input" placeholder="Deadline title..." value={newDeadline.title}
              onChange={e => setNewDeadline({ ...newDeadline, title: e.target.value })}
              style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addDeadline()} />
            <button className="btn btn-sm" onClick={addDeadline} style={{ background: '#f59e0b', color: '#fff' }}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewDeadline(false)}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" className="form-input" value={newDeadline.deadline_date}
              onChange={e => setNewDeadline({ ...newDeadline, deadline_date: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }} />
            <select className="form-select" value={newDeadline.category}
              onChange={e => setNewDeadline({ ...newDeadline, category: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }}>
              {DEADLINE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
            <input className="form-input" placeholder="Notes (optional)" value={newDeadline.notes}
              onChange={e => setNewDeadline({ ...newDeadline, notes: e.target.value })} style={{ flex: 1, fontSize: 12, padding: '4px 8px' }} />
          </div>
        </div>
      )}

      {/* Unified List */}
      {allItems.length === 0 ? (
        <div className="empty" style={{ padding: 30 }}>
          <div className="empty-icon"><CheckCircle size={28} /></div>
          <div className="empty-title" style={{ fontSize: 14 }}>No tasks or deadlines</div>
          <div className="empty-text" style={{ fontSize: 12 }}>Add tasks or deadlines to track this client's case progress</div>
        </div>
      ) : allItems.map(t => (
        <div key={t.id} className="task-item" style={{ padding: '10px 14px' }}>
          {t.isDeadline ? (
            // Deadline checkbox
            <div
              onClick={() => completeDeadline(t.deadlineId)}
              style={{
                width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                border: `2px solid ${getUrgencyColor(t.daysRemaining)}`,
                background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarClock size={10} color={getUrgencyColor(t.daysRemaining)} />
            </div>
          ) : (
            <div className={`task-checkbox ${t.done ? 'done' : ''}`} onClick={() => toggle(t.id)} style={{ width: 20, height: 20 }}>
              {t.done && <Check size={12} color="#fff" strokeWidth={3} />}
            </div>
          )}
          <div className="task-body">
            <div className={`task-title ${t.done ? 'done' : ''}`} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.title}
              {t.isDeadline && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(245,158,11,.15)', color: '#f59e0b', textTransform: 'uppercase',
                }}>Deadline</span>
              )}
            </div>
            <div className="task-meta" style={{ fontSize: 11 }}>
              {t.isDeadline ? (
                <>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3, fontSize: 10,
                    color: getUrgencyColor(t.daysRemaining), fontWeight: 600,
                  }}>
                    {t.daysRemaining < 0 ? <AlertTriangle size={10} /> : <CalendarClock size={10} />}
                    {t.daysRemaining < 0 ? `${Math.abs(t.daysRemaining)}d overdue` : t.daysRemaining === 0 ? 'Today' : `${t.daysRemaining}d remaining`}
                  </span>
                  <span className="task-badge" style={{ fontSize: 10 }}>{t.category?.replace(/_/g, ' ')}</span>
                </>
              ) : (
                <>
                  <span className={`task-badge task-priority-${t.priority}`} style={{ fontSize: 10 }}>
                    <Circle size={6} fill={PRIORITY_COLORS[t.priority]} color={PRIORITY_COLORS[t.priority]} /> {t.priority}
                  </span>
                  <span className="task-badge" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}><FolderOpen size={10} /> {t.category}</span>
                  {t.due_date && <span className="task-badge" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}><Calendar size={10} /> {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)', padding: '4px 8px' }}
            onClick={() => t.isDeadline ? deleteDeadline(t.deadlineId) : deleteTask(t.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
