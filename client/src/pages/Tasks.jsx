import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  CheckCircle, Circle, FolderOpen, User, Calendar, Trash2, Check, X, Loader,
  Plus, Search, Clock, AlertTriangle, Edit3, Save
} from 'lucide-react';

const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['PIF', 'Document Review', 'Form Filing', 'Client Follow-up', 'IRCC Submission', 'Other'];
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const PRIORITY_BG = { high: 'rgba(239,68,68,.08)', medium: 'rgba(245,158,11,.08)', low: 'rgba(16,185,129,.08)' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', category: 'Other', due_date: '', client_id: '' });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

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

  const selectedTask = tasks.find(t => t.id === selectedId);

  async function toggle(id) {
    try {
      await api.toggleTask(id);
      fetchTasks();
    } catch (e) { console.error('Toggle failed:', e); }
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    try {
      await api.createTask({ ...newTask, client_id: newTask.client_id || null });
      setNewTask({ title: '', priority: 'medium', category: 'Other', due_date: '', client_id: '' });
      setShowNewForm(false);
      fetchTasks();
    } catch (e) { console.error('Create failed:', e); }
  }

  async function deleteTask(id) {
    try {
      await api.deleteTask(id);
      if (selectedId === id) setSelectedId(null);
      fetchTasks();
    } catch (e) { console.error('Delete failed:', e); }
  }

  function startEdit() {
    if (!selectedTask) return;
    setEditForm({
      title: selectedTask.title || '',
      priority: selectedTask.priority || 'medium',
      category: selectedTask.category || 'Other',
      due_date: selectedTask.due_date ? selectedTask.due_date.slice(0, 10) : '',
      client_id: selectedTask.client_id || '',
    });
    setEditing(true);
  }

  const todo = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;
  const urgent = tasks.filter(t => !t.done && t.priority === 'high').length;

  // Filter tasks for sidebar
  const filteredTasks = tasks.filter(t => {
    if (search) {
      const s = search.toLowerCase();
      if (!t.title?.toLowerCase().includes(s) && !t.client_name?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader size={32} className="spin" style={{ color: 'var(--accent-teal)' }} />
      </div>
    );
  }

  return (
    <div className="clients-3panel">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        <button className="clients-add-btn" onClick={() => { setShowNewForm(true); setSelectedId(null); setEditing(false); }}>
          <Plus size={16} /> New Task
        </button>

        <div className="clients-search-wrap">
          <Search size={14} className="clients-search-icon" />
          <input
            className="clients-search-input"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status filters */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px', marginBottom: 6, flexWrap: 'wrap' }}>
          {[{ v: '', l: 'All' }, { v: 'todo', l: 'To Do' }, { v: 'done', l: 'Done' }].map(f => (
            <button key={f.v} className={`clients-filter-chip ${filter === f.v ? 'active' : ''}`} onClick={() => setFilter(f.v)}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px', marginBottom: 8, flexWrap: 'wrap' }}>
          {[{ v: '', l: 'All' }, ...CATEGORIES.map(c => ({ v: c, l: c.length > 10 ? c.slice(0, 10) + '…' : c }))].map(c => (
            <button key={c.v} className={`clients-filter-chip ${catFilter === c.v ? 'active' : ''}`} onClick={() => setCatFilter(c.v)}
              style={{ fontSize: 10 }}>
              {c.l}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="clients-list">
          {filteredTasks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No tasks found
            </div>
          ) : filteredTasks.map(t => (
            <div
              key={t.id}
              className={`clients-list-item ${selectedId === t.id ? 'active' : ''}`}
              onClick={() => { setSelectedId(t.id); setShowNewForm(false); setEditing(false); }}
            >
              <div className="clients-item-avatar" style={{
                background: t.done ? 'rgba(16,185,129,.15)' : PRIORITY_BG[t.priority] || 'rgba(107,114,128,.1)',
                color: t.done ? '#10b981' : PRIORITY_COLORS[t.priority] || '#6b7280',
                borderColor: t.done ? 'rgba(16,185,129,.3)' : `${PRIORITY_COLORS[t.priority]}30`,
              }}>
                {t.done ? <Check size={16} /> : <Circle size={10} fill={PRIORITY_COLORS[t.priority]} color={PRIORITY_COLORS[t.priority]} />}
              </div>
              <div className="clients-item-info">
                <div className="clients-item-name" style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>
                  {t.title}
                </div>
                <div className="clients-item-meta">
                  {t.category}{t.client_name ? ` · ${t.client_name}` : ''}
                  {t.due_date ? ` · ${new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                </div>
              </div>
              <span className="clients-item-badge" style={{
                background: PRIORITY_BG[t.priority], color: PRIORITY_COLORS[t.priority],
              }}>
                {t.priority}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {showNewForm ? (
            /* ── New Task Form ── */
            <div className="clients-detail-card">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px', color: 'var(--text-primary)' }}>Create New Task</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Task Title</label>
                  <input className="form-input" placeholder="What needs to be done?" value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Priority</label>
                    <select className="form-select" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Category</label>
                    <select className="form-select" value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Due Date</label>
                    <input type="date" className="form-input" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Client</label>
                    <select className="form-select" value={newTask.client_id} onChange={e => setNewTask({ ...newTask, client_id: e.target.value })}>
                      <option value="">No client (global task)</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={addTask}>Create Task</button>
                  <button className="btn btn-ghost" onClick={() => setShowNewForm(false)}>Cancel</button>
                </div>
              </div>
            </div>
          ) : selectedTask ? (
            /* ── Task Detail ── */
            <div>
              <div className="clients-detail-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
                        background: selectedTask.done ? '#10b981' : 'var(--bg-elevated)',
                        border: selectedTask.done ? 'none' : `2px solid ${PRIORITY_COLORS[selectedTask.priority]}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onClick={() => toggle(selectedTask.id)}
                    >
                      {selectedTask.done && <Check size={22} color="#fff" strokeWidth={3} />}
                    </div>
                    <div>
                      <h2 style={{
                        fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-primary)',
                        textDecoration: selectedTask.done ? 'line-through' : 'none',
                        opacity: selectedTask.done ? 0.6 : 1,
                      }}>
                        {selectedTask.title}
                      </h2>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="clients-tag" style={{ background: PRIORITY_BG[selectedTask.priority], color: PRIORITY_COLORS[selectedTask.priority] }}>
                          <Circle size={8} fill={PRIORITY_COLORS[selectedTask.priority]} color={PRIORITY_COLORS[selectedTask.priority]} /> {selectedTask.priority}
                        </span>
                        <span className="clients-tag" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                          <FolderOpen size={10} /> {selectedTask.category}
                        </span>
                        {selectedTask.done && (
                          <span className="clients-tag" style={{ background: 'rgba(16,185,129,.1)', color: '#10b981' }}>
                            <CheckCircle size={10} /> Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => deleteTask(selectedTask.id)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>

                {/* Task details grid */}
                {!editing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Due Date</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={14} />
                        {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No due date'}
                      </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Client</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={14} />
                        {selectedTask.client_name || 'Global task (no client)'}
                      </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Status</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: selectedTask.done ? '#10b981' : '#f59e0b' }}>
                        {selectedTask.done ? 'Completed' : 'To Do'}
                      </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Created</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Edit Form ── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title</label>
                      <input className="form-input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Priority</label>
                        <select className="form-select" value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                          {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Category</label>
                        <select className="form-select" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Due Date</label>
                        <input type="date" className="form-input" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Client</label>
                        <select className="form-select" value={editForm.client_id} onChange={e => setEditForm({ ...editForm, client_id: e.target.value })}>
                          <option value="">No client</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-primary" onClick={() => setEditing(false)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Save size={14} /> Save Changes
                      </button>
                      <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Empty State ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Select a task</div>
              <div style={{ fontSize: 13 }}>Choose a task from the sidebar or create a new one</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        {/* Task Stats */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Task Stats</div>
          <div className="clients-ctx-stat-row">
            <span>To Do</span>
            <strong style={{ color: '#f59e0b' }}>{todo}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Urgent</span>
            <strong style={{ color: '#ef4444' }}>{urgent}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Completed</span>
            <strong style={{ color: '#10b981' }}>{done}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Total</span>
            <strong>{tasks.length}</strong>
          </div>
        </div>

        {selectedTask && (
          <>
            {/* Selected Task Info */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">Selected Task</div>
              <div className="clients-ctx-row">
                <Circle size={10} fill={PRIORITY_COLORS[selectedTask.priority]} color={PRIORITY_COLORS[selectedTask.priority]} />
                <span style={{ fontWeight: 600 }}>Priority: {selectedTask.priority}</span>
              </div>
              <div className="clients-ctx-row">
                <FolderOpen size={14} color="var(--text-muted)" />
                <span>{selectedTask.category}</span>
              </div>
              <div className="clients-ctx-row">
                <Calendar size={14} color="var(--text-muted)" />
                <span>{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}</span>
              </div>
              {selectedTask.client_name && (
                <div className="clients-ctx-row">
                  <User size={14} color="var(--text-muted)" />
                  <span>{selectedTask.client_name}</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">Quick Actions</div>
              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => toggle(selectedTask.id)}
              >
                {selectedTask.done ? <Circle size={14} /> : <CheckCircle size={14} />}
                {selectedTask.done ? 'Mark as To Do' : 'Mark Complete'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => deleteTask(selectedTask.id)}
              >
                <Trash2 size={14} /> Delete Task
              </button>
            </div>
          </>
        )}

        {/* Category Breakdown */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">By Category</div>
          {CATEGORIES.map(cat => {
            const count = tasks.filter(t => t.category === cat).length;
            if (count === 0) return null;
            return (
              <div key={cat} className="clients-ctx-stat-row">
                <span>{cat}</span>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
