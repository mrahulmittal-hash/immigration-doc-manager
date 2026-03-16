import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Users, Plus, Trash2, Camera, Download, CheckCircle, Clock, AlertCircle, Edit2, Save, X, User, Heart, Baby, UserPlus } from 'lucide-react';

const RELATIONSHIPS = ['Spouse', 'Common-Law Partner', 'Child', 'Parent', 'Sibling', 'Other'];
const PHOTO_SPECS = {
  width: '35 mm × 45 mm',
  background: 'Plain white or light-coloured',
  format: 'JPEG or PNG',
  size: 'Between 240KB and 4MB (digital)',
  resolution: 'Minimum 420 × 540 pixels',
};

const REL_ICONS = { Spouse: Heart, 'Common-Law Partner': Heart, Child: Baby, Parent: Users, Sibling: Users, Other: User };

export default function DependentsPanel({ clientId, clientName }) {
  const [dependents, setDependents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', relationship: 'Spouse', date_of_birth: '', nationality: '', passport_number: '', gender: '', notes: '' });
  const [uploading, setUploading] = useState(null); // 'client' or dependent id
  const photoRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null); // { type: 'client' | 'dependent', id?, name }

  useEffect(() => { fetchAll(); }, [clientId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [deps, pics] = await Promise.all([
        api.getDependents(clientId),
        api.getPhotos(clientId),
      ]);
      setDependents(deps);
      setPhotos(pics);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleAddDependent(e) {
    e.preventDefault();
    try {
      await api.createDependent(clientId, form);
      setForm({ first_name: '', last_name: '', relationship: 'Spouse', date_of_birth: '', nationality: '', passport_number: '', gender: '', notes: '' });
      setShowAdd(false);
      fetchAll();
    } catch (e) { console.error(e); }
  }

  async function handleUpdateDependent(id) {
    try {
      await api.updateDependent(id, form);
      setEditingId(null);
      fetchAll();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this dependent and their photos?')) return;
    try { await api.deleteDependent(id); fetchAll(); } catch (e) { console.error(e); }
  }

  function startEdit(dep) {
    setEditingId(dep.id);
    setForm({ first_name: dep.first_name, last_name: dep.last_name, relationship: dep.relationship, date_of_birth: dep.date_of_birth || '', nationality: dep.nationality || '', passport_number: dep.passport_number || '', gender: dep.gender || '', notes: dep.notes || '' });
  }

  function triggerPhotoUpload(type, depId, name) {
    setUploadTarget({ type, id: depId || null, name });
    photoRef.current?.click();
  }

  async function handlePhotoFile(e) {
    const file = e.target.files[0];
    if (!file || !uploadTarget) return;
    setUploading(uploadTarget.id || 'client');
    try {
      await api.uploadPhoto(clientId, file, uploadTarget.name, uploadTarget.type, uploadTarget.id);
      fetchAll();
    } catch (err) { console.error(err); }
    setUploading(null);
    setUploadTarget(null);
    e.target.value = '';
  }

  async function handleDeletePhoto(id) {
    if (!confirm('Delete this photo?')) return;
    try { await api.deletePhoto(id); fetchAll(); } catch (e) { console.error(e); }
  }

  async function handlePhotoStatus(id, status) {
    try { await api.updatePhoto(id, { status }); fetchAll(); } catch (e) { console.error(e); }
  }

  const clientPhotos = photos.filter(p => p.person_type === 'client');
  const getDepPhotos = (depId) => photos.filter(p => p.dependent_id === depId);

  const StatusIcon = ({ status }) => {
    if (status === 'approved') return <CheckCircle size={14} style={{ color: '#10b981' }} />;
    if (status === 'rejected') return <AlertCircle size={14} style={{ color: '#ef4444' }} />;
    return <Clock size={14} style={{ color: '#f59e0b' }} />;
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#656d76' }}>Loading dependents...</div>;

  return (
    <div className="dep-panel">
      <input type="file" ref={photoRef} accept=".jpg,.jpeg,.png,.bmp,.tiff" style={{ display: 'none' }} onChange={handlePhotoFile} />

      {/* ── IRCC Photo Specifications ─────────────────────── */}
      <div className="dep-specs">
        <div className="dep-specs-title"><Camera size={16} /> IRCC Immigration Photo Requirements</div>
        <div className="dep-specs-grid">
          {Object.entries(PHOTO_SPECS).map(([k, v]) => (
            <div key={k} className="dep-spec-item">
              <span className="dep-spec-label">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
              <span className="dep-spec-value">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Client (Principal Applicant) Photo ────────────── */}
      <div className="dep-person-card">
        <div className="dep-person-header">
          <div className="dep-person-info">
            <User size={18} style={{ color: '#3b82f6' }} />
            <div>
              <div className="dep-person-name">{clientName}</div>
              <div className="dep-person-rel">Principal Applicant</div>
            </div>
          </div>
          <button className="dep-photo-btn" onClick={() => triggerPhotoUpload('client', null, clientName)} disabled={uploading === 'client'}>
            <Camera size={14} /> {uploading === 'client' ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
        {clientPhotos.length > 0 && (
          <div className="dep-photo-list">
            {clientPhotos.map(p => (
              <div key={p.id} className="dep-photo-item">
                <img src={api.getPhotoDownloadUrl(p.id)} alt={p.person_name} className="dep-photo-thumb" />
                <div className="dep-photo-meta">
                  <span className="dep-photo-name">{p.original_name}</span>
                  <span className="dep-photo-size">{(p.file_size / 1024).toFixed(0)} KB</span>
                </div>
                <div className="dep-photo-actions">
                  <StatusIcon status={p.status} />
                  <select value={p.status} onChange={e => handlePhotoStatus(p.id, e.target.value)} className="dep-status-select">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <a href={api.getPhotoDownloadUrl(p.id)} download className="dep-icon-btn"><Download size={14} /></a>
                  <button className="dep-icon-btn dep-icon-danger" onClick={() => handleDeletePhoto(p.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {clientPhotos.length === 0 && <div className="dep-no-photo">No immigration photo uploaded yet</div>}
      </div>

      {/* ── Dependents ────────────────────────────────────── */}
      <div className="dep-section-header">
        <h3><Users size={18} /> Dependents ({dependents.length})</h3>
        <button className="dep-add-btn" onClick={() => { setShowAdd(true); setEditingId(null); setForm({ first_name: '', last_name: '', relationship: 'Spouse', date_of_birth: '', nationality: '', passport_number: '', gender: '', notes: '' }); }}>
          <UserPlus size={14} /> Add Dependent
        </button>
      </div>

      {/* ── Add/Edit Form ─────────────────────────────────── */}
      {showAdd && (
        <form className="dep-form" onSubmit={handleAddDependent}>
          <div className="dep-form-title">New Dependent</div>
          <div className="dep-form-grid">
            <input placeholder="First Name *" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
            <input placeholder="Last Name *" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
            <select value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
              {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="date" placeholder="Date of Birth" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
            <input placeholder="Nationality" value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} />
            <input placeholder="Passport Number" value={form.passport_number} onChange={e => setForm({ ...form, passport_number: e.target.value })} />
            <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option value="">Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="dep-form-actions">
            <button type="submit" className="dep-save-btn"><Plus size={14} /> Add</button>
            <button type="button" className="dep-cancel-btn" onClick={() => setShowAdd(false)}><X size={14} /> Cancel</button>
          </div>
        </form>
      )}

      {/* ── Dependent Cards ───────────────────────────────── */}
      {dependents.map(dep => {
        const RelIcon = REL_ICONS[dep.relationship] || User;
        const depPhotos = getDepPhotos(dep.id);
        const isEditing = editingId === dep.id;

        return (
          <div key={dep.id} className="dep-person-card">
            <div className="dep-person-header">
              <div className="dep-person-info">
                <RelIcon size={18} style={{ color: '#8b5cf6' }} />
                <div>
                  {isEditing ? (
                    <div className="dep-edit-inline">
                      <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={{ width: 100 }} />
                      <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} style={{ width: 100 }} />
                      <select value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                      <input placeholder="Passport" value={form.passport_number} onChange={e => setForm({ ...form, passport_number: e.target.value })} style={{ width: 120 }} />
                      <button className="dep-icon-btn" onClick={() => handleUpdateDependent(dep.id)}><Save size={14} /></button>
                      <button className="dep-icon-btn" onClick={() => setEditingId(null)}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="dep-person-name">{dep.first_name} {dep.last_name}</div>
                      <div className="dep-person-rel">
                        {dep.relationship}
                        {dep.date_of_birth && <span> · DOB: {dep.date_of_birth}</span>}
                        {dep.passport_number && <span> · Passport: {dep.passport_number}</span>}
                        {dep.nationality && <span> · {dep.nationality}</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="dep-photo-btn" onClick={() => triggerPhotoUpload('dependent', dep.id, `${dep.first_name} ${dep.last_name}`)} disabled={uploading === dep.id}>
                    <Camera size={14} /> {uploading === dep.id ? 'Uploading...' : 'Upload Photo'}
                  </button>
                  <button className="dep-icon-btn" onClick={() => startEdit(dep)}><Edit2 size={14} /></button>
                  <button className="dep-icon-btn dep-icon-danger" onClick={() => handleDelete(dep.id)}><Trash2 size={14} /></button>
                </div>
              )}
            </div>

            {depPhotos.length > 0 && (
              <div className="dep-photo-list">
                {depPhotos.map(p => (
                  <div key={p.id} className="dep-photo-item">
                    <img src={api.getPhotoDownloadUrl(p.id)} alt={p.person_name} className="dep-photo-thumb" />
                    <div className="dep-photo-meta">
                      <span className="dep-photo-name">{p.original_name}</span>
                      <span className="dep-photo-size">{(p.file_size / 1024).toFixed(0)} KB</span>
                    </div>
                    <div className="dep-photo-actions">
                      <StatusIcon status={p.status} />
                      <select value={p.status} onChange={e => handlePhotoStatus(p.id, e.target.value)} className="dep-status-select">
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <a href={api.getPhotoDownloadUrl(p.id)} download className="dep-icon-btn"><Download size={14} /></a>
                      <button className="dep-icon-btn dep-icon-danger" onClick={() => handleDeletePhoto(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {depPhotos.length === 0 && <div className="dep-no-photo">No immigration photo uploaded yet</div>}
          </div>
        );
      })}

      {dependents.length === 0 && !showAdd && (
        <div className="dep-empty">
          <Users size={40} style={{ color: '#d0d7de', marginBottom: 8 }} />
          <div>No dependents added yet</div>
          <div style={{ fontSize: 12, color: '#656d76', marginTop: 4 }}>Add spouse, children, or other family members who are included in the immigration application</div>
        </div>
      )}
    </div>
  );
}
