import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AlertTriangle, Check } from 'lucide-react';

const VISA_TYPES = [
  'Express Entry', 'Study Permit', 'Work Permit (PGWP)', 'Work Permit (LMIA)',
  'Spousal Sponsorship', 'Parent/Grandparent Sponsorship', 'Visitor Visa (TRV)',
  'Super Visa', 'PR Application', 'Citizenship Application',
  'LMIA Application', 'Refugee Claim', 'Other'
];

export default function CreateClient() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [form, setForm] = useState({
    first_name:'', last_name:'', email:'', phone:'',
    nationality:'', date_of_birth:'', passport_number:'',
    visa_type:'', notes:''
  });

  function set(k, v) { setForm(f => ({...f, [k]: v})); }

  async function submit(e) {
    e.preventDefault();
    if (!form.first_name || !form.last_name) { setErr('First name and last name are required.'); return; }
    setSaving(true); setErr('');
    try {
      const client = await api.createClient(form);
      navigate(`/clients/${client.id}`);
    } catch (e) {
      setErr(e.message || 'Failed to create client');
      setSaving(false);
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Create New Client</h1>
          <p className="page-subtitle">Add a new file to your immigration practice</p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Personal Information</h2>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                className="form-input"
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="Given name(s)"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                className="form-input"
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Family name"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+1 (000) 000-0000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nationality</label>
              <input
                className="form-input"
                value={form.nationality}
                onChange={e => set('nationality', e.target.value)}
                placeholder="e.g. Indian, Filipino..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={form.date_of_birth}
                onChange={e => set('date_of_birth', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Passport Number</label>
              <input
                className="form-input"
                value={form.passport_number}
                onChange={e => set('passport_number', e.target.value)}
                placeholder="Passport ID"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Visa / Service Type</label>
              <select
                className="form-select"
                value={form.visa_type}
                onChange={e => set('visa_type', e.target.value)}
              >
                <option value="">Select a service...</option>
                {VISA_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group form-full">
              <label className="form-label">Case Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Any initial assessment or intake notes..."
              />
            </div>
          </div>
        </div>

        {err && (
          <div style={{
            marginTop: 16, padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 8, color: 'var(--accent-red)', fontSize: 13, display:'flex', alignItems:'center', gap:8
          }}>
            <AlertTriangle size={16} /> {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/clients')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{display:'flex',alignItems:'center',gap:6}}>
            {saving ? 'Creating Client...' : <><Check size={14} /> Create Client</>}
          </button>
        </div>
      </form>
    </div>
  );
}
