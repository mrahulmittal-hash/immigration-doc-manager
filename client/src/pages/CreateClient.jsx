import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AlertTriangle, Check, DollarSign } from 'lucide-react';

export default function CreateClient() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [serviceFees, setServiceFees] = useState([]);
  const [selectedFee, setSelectedFee] = useState(null);
  const [form, setForm] = useState({
    first_name:'', last_name:'', email:'', phone:'',
    nationality:'', date_of_birth:'', passport_number:'',
    visa_type:'', notes:''
  });

  useEffect(() => {
    api.getActiveServiceFees().then(setServiceFees).catch(() => {});
  }, []);

  function set(k, v) { setForm(f => ({...f, [k]: v})); }

  function handleServiceChange(e) {
    const serviceName = e.target.value;
    set('visa_type', serviceName);
    const fee = serviceFees.find(f => f.service_name === serviceName);
    setSelectedFee(fee || null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.first_name || !form.last_name) { setErr('First name and last name are required.'); return; }
    setSaving(true); setErr('');
    try {
      const client = await api.createClient(form);
      // Auto-create retainer if a service with a fee was selected
      if (selectedFee && Number(selectedFee.base_fee) > 0) {
        try {
          await api.createRetainer(client.id, {
            service_type: selectedFee.service_name,
            retainer_fee: Number(selectedFee.base_fee),
          });
        } catch (retErr) { console.error('Failed to auto-create retainer:', retErr); }
      }
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
              <label className="form-label">Service Type</label>
              <select
                className="form-select"
                value={form.visa_type}
                onChange={handleServiceChange}
              >
                <option value="">Select a service...</option>
                {serviceFees.map(sf => (
                  <option key={sf.id} value={sf.service_name}>
                    {sf.service_name}
                  </option>
                ))}
              </select>
            </div>
            {/* Fee auto-populated from admin-set service fees */}
            {selectedFee && (
              <div className="form-group form-full">
                <div style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)',
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <DollarSign size={18} style={{ color: '#6366f1' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Professional Fee
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                      ${Number(selectedFee.base_fee).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 8 }}>
                        + GST ({Number(selectedFee.gst_rate)}%) = ${(Number(selectedFee.base_fee) * (1 + Number(selectedFee.gst_rate) / 100)).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {selectedFee.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{selectedFee.description}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
