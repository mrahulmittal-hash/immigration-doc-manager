import { useState, useEffect } from 'react';
import { api } from '../api';
import { X, Save, Download, Loader, FileText, Pencil } from 'lucide-react';

const FIELD_SECTIONS = {
  personal: ['first_name', 'last_name', 'full_name', 'sex', 'marital_status', 'date_of_birth', 'place_of_birth', 'country_of_birth'],
  identity: ['nationality', 'passport_number', 'uci_number'],
  contact: ['email', 'phone', 'address'],
  employment: ['occupation', 'employer', 'employer_name', 'job_title', 'lmia_number', 'noc_code'],
  education: ['institution', 'program', 'field_of_study'],
  sponsorship: ['sponsor_first_name', 'sponsor_last_name', 'marriage_date', 'business_address'],
};

function getSectionForKey(dataKey) {
  const k = dataKey.toLowerCase();
  for (const [section, keys] of Object.entries(FIELD_SECTIONS)) {
    if (keys.some(sk => k.includes(sk) || sk.includes(k))) return section;
  }
  return 'other';
}

const SECTION_LABELS = {
  personal: 'Personal Information',
  identity: 'Identity & Citizenship',
  contact: 'Contact Information',
  employment: 'Employment',
  education: 'Education',
  sponsorship: 'Sponsorship & Relationship',
  other: 'Other Fields',
};

const SECTION_COLORS = {
  personal: '#3b82f6',
  identity: '#8b5cf6',
  contact: '#10b981',
  employment: '#f59e0b',
  education: '#ec4899',
  sponsorship: '#ef4444',
  other: '#6b7280',
};

export default function FormEditor({ filledFormId, clientId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getFilledFormData(filledFormId)
      .then(data => {
        setFormData(data);
        const initial = {};
        data.fields.forEach(f => { initial[f.pdf_field] = f.value; });
        setEditedFields(initial);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filledFormId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateFilledFormData(filledFormId, editedFields);
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  // Group fields by section
  const groupedFields = {};
  if (formData?.fields) {
    formData.fields.forEach(field => {
      const section = getSectionForKey(field.data_key);
      if (!groupedFields[section]) groupedFields[section] = [];
      groupedFields[section].push(field);
    });
  }

  const sectionOrder = ['personal', 'identity', 'contact', 'employment', 'education', 'sponsorship', 'other'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 16 }}>
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pencil size={16} />
              Edit Form Fields
            </div>
            {formData && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {formData.form_number} — {formData.form_name}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Loader size={24} className="spin" />
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {formData && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {sectionOrder.map(section => {
                const fields = groupedFields[section];
                if (!fields?.length) return null;
                const color = SECTION_COLORS[section];

                return (
                  <div key={section}>
                    <div style={{
                      fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
                      {SECTION_LABELS[section]}
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px',
                      padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 10,
                      border: '1px solid var(--border-light)',
                    }}>
                      {fields.map(field => (
                        <div key={field.pdf_field} className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                            {field.label}
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 6, fontWeight: 400 }}>
                              ({field.pdf_field})
                            </span>
                          </label>
                          <input
                            type={field.data_key.includes('date') ? 'date' : 'text'}
                            className="form-input"
                            style={{ fontSize: 13, padding: '6px 10px' }}
                            value={editedFields[field.pdf_field] || ''}
                            onChange={e => setEditedFields(prev => ({ ...prev, [field.pdf_field]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
          <a
            href={formData ? api.getFilledFormDownloadUrl(filledFormId) : '#'}
            className="btn btn-secondary"
            download
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> Download Current
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save & Regenerate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
