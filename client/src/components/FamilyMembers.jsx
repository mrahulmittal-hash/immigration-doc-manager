import { useState, useEffect } from 'react';
import { api } from '../api';
import { Users, Plus, Pencil, Trash2, X, Save, Globe, Calendar, Shield, FileText } from 'lucide-react';

const RELATIONSHIPS = ['spouse', 'child', 'parent', 'sibling', 'other'];
const IMM_STATUSES = ['citizen', 'PR', 'work_permit', 'study_permit', 'visitor', 'refugee', 'none'];
const REL_COLORS = {
  spouse:  { bg: '#fce7f3', color: '#be185d', border: '#fbcfe8' },
  child:   { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  parent:  { bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe' },
  sibling: { bg: '#d1fae5', color: '#059669', border: '#a7f3d0' },
  other:   { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
};

const EMPTY = { relationship: 'spouse', first_name: '', last_name: '', date_of_birth: '', nationality: '', passport_number: '', immigration_status: 'none', notes: '' };

export default function FamilyMembers({ clientId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => {
    api.getFamilyMembers(clientId).then(setMembers).catch(() => setMembers([])).finally(() => setLoading(false));
  };
  useEffect(load, [clientId]);

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) return;
    try {
      if (editingId) {
        await api.updateFamilyMember(editingId, form);
      } else {
        await api.addFamilyMember(clientId, form);
      }
      setShowForm(false); setEditingId(null); setForm(EMPTY); load();
    } catch (e) { console.error(e); }
  };

  const handleEdit = (m) => {
    setForm({ relationship: m.relationship, first_name: m.first_name, last_name: m.last_name, date_of_birth: m.date_of_birth || '', nationality: m.nationality || '', passport_number: m.passport_number || '', immigration_status: m.immigration_status || 'none', notes: m.notes || '' });
    setEditingId(m.id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this family member?')) return;
    await api.deleteFamilyMember(id); load();
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Family members and dependents associated with this client's immigration case.
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setEditingId(null); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Member
        </button>
      </div>

      {members.length === 0 && !showForm && (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Users size={32} /></div>
            <div className="empty-title">No family members</div>
            <div className="empty-text">Add spouse, children, parents, or siblings for the immigration case.</div>
          </div>
        </div>
      )}

      {/* Member Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {members.map(m => {
          const rc = REL_COLORS[m.relationship] || REL_COLORS.other;
          return (
            <div key={m.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: rc.bg, border: `1px solid ${rc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: rc.color }}>
                    {m.first_name[0]}{m.last_name[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.first_name} {m.last_name}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, textTransform: 'capitalize' }}>
                      {m.relationship}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(m)}><Pencil size={13} /></button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => handleDelete(m.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
                {m.date_of_birth && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><Calendar size={12} /> {m.date_of_birth}</div>}
                {m.nationality && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><Globe size={12} /> {m.nationality}</div>}
                {m.passport_number && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}><FileText size={12} /> {m.passport_number}</div>}
                {m.immigration_status && m.immigration_status !== 'none' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    <Shield size={12} /> {m.immigration_status.replace(/_/g, ' ')}
                  </div>
                )}
              </div>
              {m.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>{m.notes}</div>}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit' : 'Add'} Family Member</div>
              <button className="modal-close" onClick={() => { setShowForm(false); setEditingId(null); }}><X size={18} /></button>
            </div>
            <div className="form-grid" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Relationship</label>
                <select className="form-select" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="First name" />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input type="date" className="form-input" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Nationality</label>
                <input className="form-input" value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} placeholder="Nationality" />
              </div>
              <div className="form-group">
                <label className="form-label">Passport Number</label>
                <input className="form-input" value={form.passport_number} onChange={e => setForm({ ...form, passport_number: e.target.value })} placeholder="Passport number" />
              </div>
              <div className="form-group">
                <label className="form-label">Immigration Status</label>
                <select className="form-select" value={form.immigration_status} onChange={e => setForm({ ...form, immigration_status: e.target.value })}>
                  {IMM_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} /> {editingId ? 'Update' : 'Add'} Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
