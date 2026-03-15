import { useState, useEffect } from 'react';
import { Shield, Briefcase, Eye, KeyRound, Users, CheckCircle, Clock, Crown, Trash2, Pause, Play, X, Lightbulb, Check } from 'lucide-react';

const ROLES = ['Admin', 'Case Manager', 'Viewer'];

const ROLE_INFO = {
  Admin: {
    color: 'var(--accent-purple)',
    bg: 'rgba(139,92,246,.15)',
    Icon: Crown,
    perms: ['Full system access', 'Manage users & roles', 'Billing & retainers', 'All client data', 'Settings & configuration'],
  },
  'Case Manager': {
    color: 'var(--primary)',
    bg: 'var(--primary-glow)',
    Icon: Briefcase,
    perms: ['View & edit clients', 'Send PIF forms', 'Upload documents', 'Manage tasks & calendar', 'View retainers (read only)'],
  },
  Viewer: {
    color: 'var(--accent-teal)',
    bg: 'rgba(20,184,166,.15)',
    Icon: Eye,
    perms: ['View clients (read only)', 'View documents (read only)', 'View calendar', 'No editing permissions'],
  },
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#3b82f6,#8b5cf6)',
  'linear-gradient(135deg,#10b981,#3b82f6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#14b8a6,#3b82f6)',
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'Case Manager' });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function addUser() {
    if (!invite.name || !invite.email) return;
    const initials = invite.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    setUsers(prev => [...prev, {
      id: Date.now(), name: invite.name, email: invite.email,
      role: invite.role, status: 'pending', lastLogin: '—', avatar: initials,
    }]);
    setInvite({ name: '', email: '', role: 'Case Manager' });
    setShowInvite(false);
  }

  function changeRole(id, role) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    setEditUser(null);
  }

  function toggleStatus(id) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u));
  }

  function removeUser(id) {
    if (!confirm('Remove this user?')) return;
    setUsers(prev => prev.filter(u => u.id !== id));
  }

  const active   = users.filter(u => u.status === 'active').length;
  const pending  = users.filter(u => u.status === 'pending').length;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">Manage team members and their access roles</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={() => setShowRole(true)} style={{display:'flex',alignItems:'center',gap:6}}><KeyRound size={14} /> Role Permissions</button>
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}>+ Invite User</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card blue">
          <div className="stat-icon" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Users size={22} /></div>
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><CheckCircle size={22} /></div>
          <div className="stat-value">{active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Clock size={22} /></div>
          <div className="stat-value">{pending}</div>
          <div className="stat-label">Pending Invite</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Crown size={22} /></div>
          <div className="stat-value">{users.filter(u => u.role === 'Admin').length}</div>
          <div className="stat-label">Admins</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Hours Today</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    Loading team members...
                  </td>
                </tr>
              ) : users.map((u, idx) => {
                const ri = ROLE_INFO[u.role];
                const RoleIcon = ri.Icon;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex-center gap-12">
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13, color: '#fff',
                        }}>{u.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: ri.bg, color: ri.color,
                      }}>
                        <RoleIcon size={12} /> {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : u.status === 'pending' ? 'badge-warning' : 'badge-gray'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.lastLogin || '—'}</td>
                    <td>
                      <span className="badge badge-primary" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
                        {u.hoursToday} hrs
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(u)}>Change Role</button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: u.status === 'active' ? 'var(--accent-amber)' : 'var(--accent-green)', display:'flex', alignItems:'center', gap:4 }}
                          onClick={() => toggleStatus(u.id)}
                        >
                          {u.status === 'active' ? <><Pause size={12} /> Deactivate</> : <><Play size={12} /> Activate</>}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)', display:'flex', alignItems:'center' }} onClick={() => removeUser(u.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permissions Overview */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Role Capabilities</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 }}>
          {Object.entries(ROLE_INFO).map(([role, ri]) => {
            const RoleIcon = ri.Icon;
            return (
              <div key={role} style={{
                background: 'var(--bg-elevated)', border: `1px solid ${ri.color}30`,
                borderRadius: 'var(--radius)', padding: '16px 16px',
                borderTop: `3px solid ${ri.color}`,
              }}>
                <div style={{ marginBottom: 6, color: ri.color }}><RoleIcon size={22} /></div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: ri.color }}>{role}</div>
                {ri.perms.map(p => (
                  <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--accent-green)', marginTop: 1, flexShrink: 0 }}><Check size={12} /></span>
                    {p}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Invite Team Member</div>
              <button className="modal-close" onClick={() => setShowInvite(false)}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid var(--primary-glow)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, display:'flex', alignItems:'center', gap:8 }}>
                <Lightbulb size={14} /> An invitation email will be sent to the new team member with instructions to set up their account.
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="e.g. Sarah Kim" value={invite.name} onChange={e => setInvite({ ...invite, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Email Address</label>
                <input type="email" className="form-input" placeholder="sarah@propagent.ca" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Assign Role</label>
                <select className="form-select" value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {invite.role && (() => {
                  const ri = ROLE_INFO[invite.role];
                  const RoleIcon = ri.Icon;
                  return (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: ri.bg, borderRadius: 6, fontSize: 11, color: ri.color, display:'flex', alignItems:'center', gap:6 }}>
                      <RoleIcon size={12} /> {ri.perms.join(' · ')}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addUser}>Send Invitation</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Change Role — {editUser.name}</div>
              <button className="modal-close" onClick={() => setEditUser(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ROLES.map(r => {
                const ri = ROLE_INFO[r];
                const RoleIcon = ri.Icon;
                const selected = editUser.role === r;
                return (
                  <div
                    key={r}
                    onClick={() => changeRole(editUser.id, r)}
                    style={{
                      border: selected ? `2px solid ${ri.color}` : '2px solid var(--border)',
                      borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                      background: selected ? ri.bg : 'var(--bg-elevated)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="flex-center gap-10" style={{ marginBottom: 6 }}>
                      <span style={{ color: ri.color }}><RoleIcon size={18} /></span>
                      <span style={{ fontWeight: 700, color: ri.color }}>{r}</span>
                      {selected && <span style={{ marginLeft: 'auto', background: ri.color, color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>Current</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ri.perms.slice(0, 3).join(' · ')}</div>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
