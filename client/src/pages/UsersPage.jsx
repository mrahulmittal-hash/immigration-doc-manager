import { useState, useEffect } from 'react';
import {
  Shield, Briefcase, Eye, KeyRound, Users, CheckCircle, Clock, Crown,
  Trash2, Pause, Play, X, Lightbulb, Check, Plus, Search
} from 'lucide-react';
import { API_URL } from '../api';

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

export default function UsersPage({ embedded = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'Case Manager' });

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
    if (selectedId === id) setSelectedId(null);
  }

  const selectedUser = users.find(u => u.id === selectedId);
  const active = users.filter(u => u.status === 'active').length;
  const pending = users.filter(u => u.status === 'pending').length;

  const filteredUsers = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!u.name?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="clients-3panel" style={embedded ? { margin: 0, height: 'calc(100vh - 160px)' } : undefined}>
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        <button className="clients-add-btn" onClick={() => { setShowInvite(true); setSelectedId(null); }}>
          <Plus size={16} /> Invite User
        </button>

        <div className="clients-search-wrap">
          <Search size={14} className="clients-search-icon" />
          <input className="clients-search-input" placeholder="Search users..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '0 12px', marginBottom: 8, flexWrap: 'wrap' }}>
          {[{ v: '', l: 'All' }, ...ROLES.map(r => ({ v: r, l: r }))].map(f => (
            <button key={f.v} className={`clients-filter-chip ${roleFilter === f.v ? 'active' : ''}`}
              onClick={() => setRoleFilter(f.v)}>
              {f.l}
            </button>
          ))}
        </div>

        <div className="clients-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No users found</div>
          ) : filteredUsers.map((u, idx) => {
            const ri = ROLE_INFO[u.role] || ROLE_INFO['Viewer'];
            return (
              <div key={u.id}
                className={`clients-list-item ${selectedId === u.id ? 'active' : ''}`}
                onClick={() => { setSelectedId(u.id); setShowInvite(false); }}
              >
                <div className="clients-item-avatar" style={{
                  background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
                  color: '#fff', borderColor: 'transparent',
                  borderRadius: '50%',
                }}>
                  {u.avatar || u.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="clients-item-info">
                  <div className="clients-item-name">{u.name}</div>
                  <div className="clients-item-meta">{u.email}</div>
                </div>
                <span className="clients-item-badge" style={{ background: ri.bg, color: ri.color }}>
                  {u.role}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {showInvite ? (
            /* ── Invite Form ── */
            <div className="clients-detail-card">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px', color: 'var(--text-primary)' }}>Invite Team Member</h2>
              <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid var(--primary-glow)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={14} /> An invitation email will be sent with instructions to set up their account.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Full Name</label>
                  <input className="form-input" placeholder="e.g. Sarah Kim" value={invite.name}
                    onChange={e => setInvite({ ...invite, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email Address</label>
                  <input type="email" className="form-input" placeholder="sarah@propagent.ca" value={invite.email}
                    onChange={e => setInvite({ ...invite, email: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Assign Role</label>
                  <select className="form-select" value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {invite.role && (() => {
                    const ri = ROLE_INFO[invite.role];
                    const RoleIcon = ri.Icon;
                    return (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: ri.bg, borderRadius: 6, fontSize: 11, color: ri.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RoleIcon size={12} /> {ri.perms.join(' · ')}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={addUser}>Send Invitation</button>
                  <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
                </div>
              </div>
            </div>
          ) : selectedUser ? (
            /* ── User Detail ── */
            <div>
              {/* Hero */}
              <div className="clients-detail-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: AVATAR_GRADIENTS[users.indexOf(selectedUser) % AVATAR_GRADIENTS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 18, color: '#fff',
                  }}>
                    {selectedUser.avatar || selectedUser.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{selectedUser.name}</h2>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{selectedUser.email}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {(() => {
                        const ri = ROLE_INFO[selectedUser.role] || ROLE_INFO['Viewer'];
                        const RoleIcon = ri.Icon;
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ri.bg, color: ri.color }}>
                            <RoleIcon size={12} /> {selectedUser.role}
                          </span>
                        );
                      })()}
                      <span className={`badge ${selectedUser.status === 'active' ? 'badge-success' : selectedUser.status === 'pending' ? 'badge-warning' : 'badge-gray'}`}>
                        {selectedUser.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Last Login</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedUser.lastLogin || '—'}</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Hours Today</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedUser.hoursToday || 0} hrs</div>
                  </div>
                </div>
              </div>

              {/* Role Permissions */}
              <div className="clients-detail-card">
                <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Role Permissions</h3>
                {(() => {
                  const ri = ROLE_INFO[selectedUser.role] || ROLE_INFO['Viewer'];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ri.perms.map(p => (
                        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                          <Check size={14} color="#10b981" />
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* ── Empty State ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <Users size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Select a team member</div>
              <div style={{ fontSize: 13 }}>Choose a user from the sidebar or invite a new one</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        {/* Team Stats */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Team Stats</div>
          <div className="clients-ctx-stat-row">
            <span>Total Users</span>
            <strong>{users.length}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Active</span>
            <strong style={{ color: '#10b981' }}>{active}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Pending</span>
            <strong style={{ color: '#f59e0b' }}>{pending}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Admins</span>
            <strong style={{ color: 'var(--accent-purple)' }}>{users.filter(u => u.role === 'Admin').length}</strong>
          </div>
        </div>

        {selectedUser && (
          <>
            {/* Selected User Info */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">User Info</div>
              <div className="clients-ctx-row">
                {(() => {
                  const ri = ROLE_INFO[selectedUser.role] || ROLE_INFO['Viewer'];
                  const RoleIcon = ri.Icon;
                  return <><RoleIcon size={14} color={ri.color} /><span style={{ fontWeight: 600 }}>{selectedUser.role}</span></>;
                })()}
              </div>
              <div className="clients-ctx-row">
                <Clock size={14} color="var(--text-muted)" />
                <span>Last login: {selectedUser.lastLogin || '—'}</span>
              </div>
              <div className="clients-ctx-row">
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: selectedUser.status === 'active' ? '#10b981' : selectedUser.status === 'pending' ? '#f59e0b' : '#9ca3af',
                }} />
                <span>{selectedUser.status}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="clients-ctx-section">
              <div className="clients-ctx-label">Quick Actions</div>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginBottom: 8, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setEditUser(selectedUser)}>
                <KeyRound size={14} /> Change Role
              </button>
              <button className="btn btn-ghost btn-sm"
                style={{ width: '100%', marginBottom: 8, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, color: selectedUser.status === 'active' ? '#f59e0b' : '#10b981' }}
                onClick={() => toggleStatus(selectedUser.id)}>
                {selectedUser.status === 'active' ? <><Pause size={14} /> Deactivate</> : <><Play size={14} /> Activate</>}
              </button>
              <button className="btn btn-ghost btn-sm"
                style={{ width: '100%', color: '#ef4444', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => removeUser(selectedUser.id)}>
                <Trash2 size={14} /> Remove User
              </button>
            </div>
          </>
        )}

        {/* Role Overview */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Roles Breakdown</div>
          {ROLES.map(role => {
            const ri = ROLE_INFO[role];
            const count = users.filter(u => u.role === role).length;
            return (
              <div key={role} className="clients-ctx-stat-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ri.color }} />
                  {role}
                </span>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      </div>

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
                  <div key={r} onClick={() => changeRole(editUser.id, r)}
                    style={{
                      border: selected ? `2px solid ${ri.color}` : '2px solid var(--border)',
                      borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                      background: selected ? ri.bg : 'var(--bg-elevated)', transition: 'all 0.15s',
                    }}>
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
