import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['PIF', 'Document Review', 'Form Filing', 'Client Follow-up', 'IRCC Submission', 'Other'];

const SAMPLE_TASKS = [
  { id:1, title:'Send PIF to Anish Sharma',           done:false, priority:'high',   cat:'PIF',              due:'2026-03-15', client:'Anish Sharma' },
  { id:2, title:'Review passport copies for W. Chen',  done:false, priority:'high',   cat:'Document Review',  due:'2026-03-16', client:'Wei Chen' },
  { id:3, title:'Fill IMM5257 for P. Nguyen',          done:false, priority:'medium', cat:'Form Filing',      due:'2026-03-18', client:'Phuong Nguyen' },
  { id:4, title:'Follow up on IELTS scores',           done:true,  priority:'medium', cat:'Client Follow-up', due:'2026-03-14', client:'Raj Patel' },
  { id:5, title:'Submit Express Entry profile',        done:false, priority:'high',   cat:'IRCC Submission',  due:'2026-03-20', client:'Maria Garcia' },
];

export default function Tasks() {
  const [tasks, setTasks] = useState(SAMPLE_TASKS);
  const [filter, setFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ title:'', priority:'medium', cat:'Other', due:'', client:'' });

  const filtered = tasks.filter(t => {
    if (filter === 'done' && !t.done) return false;
    if (filter === 'todo' && t.done) return false;
    if (catFilter !== 'all' && t.cat !== catFilter) return false;
    return true;
  });

  function toggle(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function addTask() {
    if (!newTask.title.trim()) return;
    setTasks(prev => [...prev, { ...newTask, id: Date.now(), done: false }]);
    setNewTask({ title:'', priority:'medium', cat:'Other', due:'', client:'' });
    setShowNew(false);
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  const todo   = tasks.filter(t => !t.done).length;
  const done   = tasks.filter(t =>  t.done).length;
  const urgent = tasks.filter(t => !t.done && t.priority === 'high').length;

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
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[
          { label:'To Do',  value:todo,   color:'var(--accent-amber)' },
          { label:'Urgent', value:urgent, color:'var(--accent-red)' },
          { label:'Done',   value:done,   color:'var(--accent-green)' },
        ].map(s => (
          <div key={s.label} className="card flex-center gap-12" style={{ flex:1, padding:'14px 18px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {['all','todo','done'].map(f => (
          <button key={f} className={`filter-pill ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All Tasks' : f === 'todo' ? '⬜ To Do' : '✅ Done'}
          </button>
        ))}
        <div style={{ width:1, background:'var(--border)', margin:'0 4px' }} />
        {['all',...CATEGORIES].map(c => (
          <button key={c} className={`filter-pill ${catFilter===c?'active':''}`} onClick={() => setCatFilter(c)}>
            {c === 'all' ? 'All Categories' : c}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            <div className="empty-title">No tasks found</div>
            <div className="empty-text">All clear — or adjust your filters</div>
          </div>
        ) : filtered.map(t => (
          <div key={t.id} className="task-item">
            <div
              className={`task-checkbox ${t.done ? 'done' : ''}`}
              onClick={() => toggle(t.id)}
            >
              {t.done && <span style={{ color:'#fff', fontSize:14, fontWeight: 900 }}>✓</span>}
            </div>
            <div className="task-body">
              <div className={`task-title ${t.done ? 'done' : ''}`}>{t.title}</div>
              <div className="task-meta">
                <span className={`task-badge task-priority-${t.priority}`}>
                  {t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'} {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                </span>
                <span className="task-badge">📂 {t.cat}</span>
                {t.client && <span className="task-badge">👤 {t.client}</span>}
                {t.due && <span className="task-badge">📅 {new Date(t.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ color:'var(--accent-red)', background: 'rgba(239, 68, 68, 0.05)', border: 'none', padding: '8px 12px' }} onClick={() => deleteTask(t.id)}>🗑 Delete</button>
          </div>
        ))}
      </div>

      {/* New Task Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Task</div>
              <button className="modal-close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="form-group" style={{ marginBottom:12 }}>
              <label className="form-label">Task Title</label>
              <input className="form-input" placeholder="What needs to be done?" value={newTask.title}
                onChange={e => setNewTask({...newTask, title:e.target.value})} />
            </div>
            <div className="form-grid" style={{ marginBottom:12 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={newTask.priority} onChange={e => setNewTask({...newTask, priority:e.target.value})}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={newTask.cat} onChange={e => setNewTask({...newTask, cat:e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={newTask.due} onChange={e => setNewTask({...newTask, due:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Client Name</label>
                <input className="form-input" placeholder="Client (optional)" value={newTask.client}
                  onChange={e => setNewTask({...newTask, client:e.target.value})} />
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
