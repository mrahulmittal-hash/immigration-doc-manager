import { useState, useEffect } from 'react';
import { Building, Save, Shield } from 'lucide-react';
import { api } from '../api';

const PROVINCES = ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'];

export default function FirmProfileTab() {
  const [form, setForm] = useState({
    rcic_name: '', rcic_license: '', business_name: '', address: '',
    city: '', province: '', postal_code: '', phone: '', email: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      const data = await api.getFirmProfile();
      if (data && Object.keys(data).length > 0) {
        setForm({
          rcic_name: data.rcic_name || '',
          rcic_license: data.rcic_license || '',
          business_name: data.business_name || '',
          address: data.address || '',
          city: data.city || '',
          province: data.province || '',
          postal_code: data.postal_code || '',
          phone: data.phone || '',
          email: data.email || '',
        });
      }
    } catch (err) { console.error(err); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateFirmProfile(form);
      setMsg('Firm profile saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
    setSaving(false);
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '8px 0' }}>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={18} /> Firm Profile
          </h3>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
        <div style={{ padding: 24 }}>
          {msg && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: msg.includes('error') ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
              color: msg.includes('error') ? 'var(--danger)' : 'var(--accent-green)' }}>
              {msg}
            </div>
          )}

          {/* RCIC Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} /> RCIC CONSULTANT DETAILS
            </div>
            <div className="form-grid">
              <div>
                <label className="form-label">RCIC Full Name</label>
                <input className="form-input" value={form.rcic_name} onChange={e => set('rcic_name', e.target.value)} placeholder="e.g. Nitish Dev" />
              </div>
              <div>
                <label className="form-label">License Number</label>
                <input className="form-input" value={form.rcic_license} onChange={e => set('rcic_license', e.target.value)} placeholder="e.g. R530287" />
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building size={14} /> BUSINESS DETAILS
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <label className="form-label">Business Name</label>
                <input className="form-input" value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="e.g. New Way Immigration" />
              </div>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Street Address</label>
                <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. 123 Main Street NW" />
              </div>
              <div>
                <label className="form-label">City</label>
                <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Edmonton" />
              </div>
              <div>
                <label className="form-label">Province</label>
                <select className="form-select" value={form.province} onChange={e => set('province', e.target.value)}>
                  <option value="">Select province</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Postal Code</label>
                <input className="form-input" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} placeholder="e.g. T5K 2B6" />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>CONTACT</div>
            <div className="form-grid">
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="e.g. 780-555-0000" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="e.g. info@newwayimmigration.ca" />
              </div>
            </div>
          </div>

          {/* Populated preview */}
          <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-subtle)', borderRadius: 10, fontSize: 13 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>AGREEMENT HEADER PREVIEW</div>
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              <strong>{form.rcic_name || '___'}</strong><br />
              Regulated Canadian Immigration Consultant (RCIC)<br />
              License Number: {form.rcic_license || '___'}<br />
              Business: {form.business_name || '___'}<br />
              {[form.address, form.city, form.province, form.postal_code].filter(Boolean).join(', ') || '___'}<br />
              Phone: {form.phone || '___'} | Email: {form.email || '___'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
