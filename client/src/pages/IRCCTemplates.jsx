import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import {
  FileText, Search, Upload, Download, Trash2, CheckCircle, Clock,
  ChevronRight, Filter, X, AlertTriangle, FolderOpen, Globe
} from 'lucide-react';

const CATEGORY_COLORS = {
  'Express Entry': '#4f46e5',
  'Study Permit': '#3b82f6',
  'Work Permit (PGWP)': '#0d9488',
  'Work Permit (LMIA)': '#0d9488',
  'Spousal Sponsorship': '#8b5cf6',
  'PR Application': '#10b981',
  'Visitor Visa (TRV)': '#f59e0b',
  'Refugee Claim': '#ef4444',
  'Parent/Grandparent Sponsorship': '#8b5cf6',
  'Super Visa': '#f59e0b',
  'Citizenship Application': '#10b981',
  'LMIA Application': '#6b7280',
  'Provincial Nominee (PNP)': '#4f46e5',
  'PR Card Renewal': '#10b981',
  'eTA': '#6b7280',
  'Open Work Permit': '#0d9488',
  'Atlantic Immigration (AIP)': '#818cf8',
  'IEC (Working Holiday)': '#0d9488',
};

export default function IRCCTemplates() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const d = await api.getIRCCTemplatesList();
      setData(d);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
    setLoading(false);
  };

  const handleUpload = async (formNumber, formName, visaType) => {
    fileRef.current.dataset.formNumber = formNumber;
    fileRef.current.dataset.formName = formName;
    fileRef.current.dataset.visaType = visaType;
    fileRef.current.click();
  };

  const onFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { formNumber, formName, visaType } = e.target.dataset;
    setUploading(formNumber);
    try {
      await api.uploadIRCCTemplate(formNumber, file, formName, visaType);
      await loadTemplates();
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(null);
    e.target.value = '';
  };

  const handleDelete = async (formNumber) => {
    if (!window.confirm('Remove this uploaded template?')) return;
    try {
      await api.deleteIRCCTemplate(formNumber);
      await loadTemplates();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const categories = data?.categories || [];
  const stats = data?.stats || {};

  // Filter
  const filtered = categories
    .filter(c => !selectedCategory || c.visaType === selectedCategory)
    .map(c => ({
      ...c,
      forms: c.forms.filter(f =>
        !search || f.form_number?.toLowerCase().includes(search.toLowerCase()) ||
        f.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.visaType.toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter(c => c.forms.length > 0);

  return (
    <div className="ircc-templates-page">
      <input type="file" ref={fileRef} accept=".pdf" style={{ display: 'none' }} onChange={onFileSelected} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          IRCC Form Templates
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Manage fillable IRCC form templates organized by visa category
        </p>
      </div>

      {/* Stats */}
      <div className="dash-stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="dash-stat-card">
          <div className="dash-stat-accent" style={{ background: '#4f46e5' }} />
          <div className="dash-stat-value" style={{ color: '#4f46e5' }}>{stats.totalCategories || 0}</div>
          <div className="dash-stat-label">Visa Categories</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-accent" style={{ background: '#3b82f6' }} />
          <div className="dash-stat-value" style={{ color: '#3b82f6' }}>{stats.totalForms || 0}</div>
          <div className="dash-stat-label">Total Forms</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-accent" style={{ background: '#10b981' }} />
          <div className="dash-stat-value" style={{ color: '#10b981' }}>{stats.uploadedForms || 0}</div>
          <div className="dash-stat-label">Templates Uploaded</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-accent" style={{ background: '#f59e0b' }} />
          <div className="dash-stat-value" style={{ color: '#f59e0b' }}>{stats.pendingForms || 0}</div>
          <div className="dash-stat-label">Pending Upload</div>
        </div>
      </div>

      <div className="ircc-templates-layout">
        {/* Sidebar */}
        <div className="ircc-category-sidebar">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search forms..."
                style={{
                  width: '100%', padding: '8px 10px 8px 30px', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12, background: 'var(--bg-base)', outline: 'none',
                }}
              />
            </div>
          </div>
          <button
            className={`ircc-cat-btn ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            <Globe size={14} /> All Categories
            <span className="ircc-cat-count">{categories.length}</span>
          </button>
          {categories.map(c => (
            <button
              key={c.visaType}
              className={`ircc-cat-btn ${selectedCategory === c.visaType ? 'active' : ''}`}
              onClick={() => setSelectedCategory(c.visaType)}
            >
              <div className="ircc-cat-dot" style={{ background: CATEGORY_COLORS[c.visaType] || '#6b7280' }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{c.visaType}</span>
              <span className="ircc-cat-count">{c.forms.length}</span>
            </button>
          ))}
        </div>

        {/* Main */}
        <div className="ircc-templates-main">
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <FolderOpen size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No forms found</div>
            </div>
          ) : (
            filtered.map(cat => (
              <div key={cat.visaType} className="ircc-cat-section">
                <div className="ircc-cat-header">
                  <div className="ircc-cat-header-dot" style={{ background: CATEGORY_COLORS[cat.visaType] || '#6b7280' }} />
                  <h3>{cat.visaType}</h3>
                  <span className="ircc-cat-header-count">{cat.forms.length} form{cat.forms.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="ircc-form-grid">
                  {cat.forms.map(form => (
                    <div key={form.form_number} className={`ircc-form-card ${form.uploaded ? 'uploaded' : ''}`}>
                      <div className="ircc-form-card-top">
                        <div className="ircc-form-number">{form.form_number}</div>
                        {form.uploaded ? (
                          <CheckCircle size={16} color="#10b981" />
                        ) : (
                          <Clock size={16} color="#9ca3af" />
                        )}
                      </div>
                      <div className="ircc-form-name">{form.name || form.form_number}</div>
                      {form.field_mappings && (
                        <div className="ircc-form-fields">{Object.keys(form.field_mappings).length} field{Object.keys(form.field_mappings).length !== 1 ? 's' : ''} mapped</div>
                      )}
                      <div className="ircc-form-actions">
                        {form.uploaded ? (
                          <>
                            <a href={api.downloadIRCCTemplate(form.form_number)} className="ircc-form-btn download" target="_blank" rel="noreferrer">
                              <Download size={12} /> Download
                            </a>
                            <button className="ircc-form-btn delete" onClick={() => handleDelete(form.form_number)}>
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : (
                          <button
                            className="ircc-form-btn upload"
                            onClick={() => handleUpload(form.form_number, form.name, cat.visaType)}
                            disabled={uploading === form.form_number}
                          >
                            <Upload size={12} /> {uploading === form.form_number ? 'Uploading...' : 'Upload PDF'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
