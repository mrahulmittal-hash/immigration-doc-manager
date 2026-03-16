import { useState } from 'react';
import { ScanLine, Check, X, AlertTriangle, User } from 'lucide-react';

const FIELD_LABELS = {
  passport_number: 'Passport Number',
  first_name: 'First Name',
  last_name: 'Last Name',
  full_name: 'Full Name',
  date_of_birth: 'Date of Birth',
  nationality: 'Nationality',
  nationality_full: 'Nationality (Full)',
  country_of_issue: 'Country of Issue',
  country_of_issue_full: 'Country (Full)',
  expiry_date: 'Expiry Date',
  sex: 'Sex',
};

export default function OcrConfirmModal({ data, onConfirm, onClose }) {
  const [fields, setFields] = useState(data?.fields || {});
  const [updateClient, setUpdateClient] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleFieldChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onConfirm(fields, updateClient);
    } finally {
      setSaving(false);
    }
  };

  const confidence = data?.confidence || 0;
  const method = data?.method || 'unknown';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ScanLine size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>OCR Results</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {method === 'mrz' ? 'Parsed from MRZ zone' : 'Extracted from text labels'} •
                Confidence: {confidence.toFixed(0)}%
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {confidence < 50 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 10, marginBottom: 20, fontSize: 13, color: '#f59e0b'
          }}>
            <AlertTriangle size={16} />
            Low confidence — please verify all fields carefully before saving.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {Object.entries(fields).map(([key, value]) => (
            <div key={key} className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                {FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </label>
              <input
                type="text"
                className="form-input"
                value={value || ''}
                onChange={e => handleFieldChange(key, e.target.value)}
                style={{ fontSize: 14, padding: '8px 12px' }}
              />
            </div>
          ))}
        </div>

        {Object.keys(fields).length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            No fields could be extracted from this image. Try a clearer scan.
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'var(--bg-elevated)', borderRadius: 10, marginBottom: 20
        }}>
          <input
            type="checkbox"
            id="updateClient"
            checked={updateClient}
            onChange={e => setUpdateClient(e.target.checked)}
            style={{ accentColor: 'var(--primary)' }}
          />
          <label htmlFor="updateClient" style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={14} />
            Also update client profile fields (passport, DOB, nationality)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || Object.keys(fields).length === 0}
          >
            {saving ? 'Saving...' : (
              <>
                <Check size={16} />
                Save {Object.keys(fields).length} Fields
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
