import { useState, useEffect } from 'react';
import { api } from '../api';
import { CheckCircle, Circle, FolderOpen, User, Calendar, Trash2, Check, X, Loader } from 'lucide-react';

const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['PIF', 'Document Review', 'Form Filing', 'Client Follow-up', 'IRCC Submission', 'Other'];
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [clients, setClients] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', category: 'Other', due_date: '', client_id: '' });

  const fetchTasks = async () => {
    try {
      const data = await api.getTasks(filter, catFilter);
      setTasks(data);
    } catch (e) { console.error('Failed to load tasks:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [filter, catFilter]);

  useEffect(() => {
    api.getClients().then(data => setClients(Array.isArray(data) ? data : data.clients || [])).catch(() => {});
  }, []);

  async function toggle(id) {
    try {
      await api.toggleTask(id);
      fetchTasks();
    } catch (e) { console.error('Toggle failed:', e); }
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    try {
      await api.createTask({
        ...newTask,
        client_id: newTask.client_id || null,
      });
      setNewTask({ title: '', priority: 'medium', category: 'Other', due_date: '', client_id: '' });
      setShowNew(false);
      fetchTasks();
    } catch (e) { console.error('Create failed:', e); }
  }

  async function deleteTask(id) {
    try {
      await api.deleteTask(id);
      fetchTasks();
    } catch (e) { console.error('Delete failed:', e); }
  }

  const todo = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;
  const urgent = tasks.filter(t => !t.done && t.priority === 'high').length;

  if (loading) {
    return (
      <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader size={32} className="spin" style={{ color: 'var(--accent-teal)' }} />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Tasks</div>
          <div className="page-subtitle">Manage your practice to-do list</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Task</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'To Do', value: todo, color: 'var(--accent-amber)' },
          { label: 'Urgent', value: urgent, color: 'var(--accent-red)' },
          { label: 'Done', value: done, color: 'var(--accent-green)' },
        ].map(s => (
          <div key={s.label} className="card flex-center gap-12" style={{ flex: 1, padding: '14px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[{ v: '', l: 'All Tasks' }, { v: 'todo', l: 'To Do' }, { v: 'done', l: 'Done' }].map(f => (
          <button key={f.v} className={`filter-pill ${filter === f.v ? 'active' : ''}`} onClick={() => setFilter(f.v)}>
            {f.l}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        {[{ v: '', l: 'All Categories' }, ...CATEGORIES.map(c => ({ v: c, l: c }))].map(c => (
          <button key={c.v} className={`filter-pill ${catFilter === c.v ? 'active' : ''}`} onClick={() => setCatFilter(c.v)}>
            {c.l}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {tasks.length === 0 && !filter && !catFilter ? (
          <div className="empty">
            <div className="empty-icon"><CheckCircle size={32} /></div>
            <div className="empty-title">No tasks yet</div>
            <div className="empty-text">Click "+ New Task" to create your first task</div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><CheckCircle size={32} /></div>
            <div className="empty-title">No tasks found</div>
            <div className="empty-text">All clear — or adjust your filters</div>
          </div>
        ) : tasks.map(t => (
          <div key={t.id} className="task-item">
            <div className={`task-checkbox ${t.done ? 'done' : ''}`} onClick={() => toggle(t.id)}>
              {t.done && <Check size={14} color="#fff" strokeWidth={3} />}
            </div>
            <div className="task-body">
              <div className={`task-title ${t.done ? 'done' : ''}`}>{t.title}</div>
              <div className="task-meta">
                <span className={`task-badge task-priority-${t.priority}`}>
                  <Circle size={8} fill={PRIORITY_COLORS[t.priority]} color={PRIORITY_COLORS[t.priority]} /> {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                </span>
                <span className="task-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FolderOpen size={12} /> {t.category}</span>
                {t.client_name && <span className="task-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> {t.client_name}</span>}
                {t.due_date && <span className="task-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.05)', border: 'none', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => deleteTask(t.id)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        ))}
      </div>

      {/* New Task Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Task</div>
              <button className="modal-close" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Task Title</label>
              <input className="form-input" placeholder="What needs to be done?" value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
            </div>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Client</label>
                <select className="form-select" value={newTask.client_id} onChange={e => setNewTask({ ...newTask, client_id: e.target.value })}>
                  <option value="">No client (global task)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTask}>Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
