import { useState, useEffect } from 'react';
import { api } from '../api';
import { CheckCircle, Circle, FolderOpen, Calendar, Trash2, Check, X, Loader, Plus } from 'lucide-react';

const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['PIF', 'Document Review', 'Form Filing', 'Client Follow-up', 'IRCC Submission', 'Other'];
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

export default function TaskPanel({ clientId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', category: 'Other', due_date: '' });

  const fetchTasks = async () => {
    try {
      const data = await api.getTasks(filter, '', clientId);
      setTasks(data);
    } catch (e) { console.error('Failed to load tasks:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [filter, clientId]);

  async function toggle(id) {
    try {
      await api.toggleTask(id);
      fetchTasks();
    } catch (e) { console.error('Toggle failed:', e); }
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    try {
      await api.createTask({ ...newTask, client_id: clientId });
      setNewTask({ title: '', priority: 'medium', category: 'Other', due_date: '' });
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
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{todo} to do, {done} done</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ v: '', l: 'All' }, { v: 'todo', l: 'To Do' }, { v: 'done', l: 'Done' }].map(f => (
              <button key={f.v} className={`filter-pill ${filter === f.v ? 'active' : ''}`} onClick={() => setFilter(f.v)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* Inline New Task Form */}
      {showNew && (
        <div className="card" style={{ padding: 14, marginBottom: 12, background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="form-input" placeholder="Task title..." value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addTask()} />
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

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="empty" style={{ padding: 30 }}>
          <div className="empty-icon"><CheckCircle size={28} /></div>
          <div className="empty-title" style={{ fontSize: 14 }}>No tasks</div>
          <div className="empty-text" style={{ fontSize: 12 }}>Click "Add Task" to create one for this client</div>
        </div>
      ) : tasks.map(t => (
        <div key={t.id} className="task-item" style={{ padding: '10px 14px' }}>
          <div className={`task-checkbox ${t.done ? 'done' : ''}`} onClick={() => toggle(t.id)} style={{ width: 20, height: 20 }}>
            {t.done && <Check size={12} color="#fff" strokeWidth={3} />}
          </div>
          <div className="task-body">
            <div className={`task-title ${t.done ? 'done' : ''}`} style={{ fontSize: 13 }}>{t.title}</div>
            <div className="task-meta" style={{ fontSize: 11 }}>
              <span className={`task-badge task-priority-${t.priority}`} style={{ fontSize: 10 }}>
                <Circle size={6} fill={PRIORITY_COLORS[t.priority]} color={PRIORITY_COLORS[t.priority]} /> {t.priority}
              </span>
              <span className="task-badge" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}><FolderOpen size={10} /> {t.category}</span>
              {t.due_date && <span className="task-badge" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}><Calendar size={10} /> {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)', padding: '4px 8px' }} onClick={() => deleteTask(t.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
