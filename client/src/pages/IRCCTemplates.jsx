import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import {
  FileText, Search, Upload, Download, Trash2, CheckCircle, Clock,
  FolderOpen, Globe, Eye
} from 'lucide-react';
import PDFFormViewer from '../components/PDFFormViewer';

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
  const [viewingForm, setViewingForm] = useState(null);
  const fileRef = useRef();

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const d = await api.getIRCCTemplatesList();
      setData(d);
    } catch (e) { console.error('Failed to load templates:', e); }
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
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(null);
    e.target.value = '';
  };

  const handleDelete = async (formNumber) => {
    if (!window.confirm('Remove this uploaded template?')) return;
    try {
      await api.deleteIRCCTemplate(formNumber);
      await loadTemplates();
    } catch (err) { console.error('Delete failed:', err); }
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const categories = data?.categories || [];
  const stats = data?.stats || {};

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

  const selectedCat = categories.find(c => c.visaType === selectedCategory);
  const selectedCatUploaded = selectedCat ? selectedCat.forms.filter(f => f.uploaded).length : 0;
  const completionPct = stats.totalForms ? Math.round((stats.uploadedForms / stats.totalForms) * 100) : 0;

  return (
    <div className="clients-3panel">
      <input type="file" ref={fileRef} accept=".pdf" style={{ display: 'none' }} onChange={onFileSelected} />

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        <div style={{ padding: '16px 12px 8px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>IRCC Forms</div>
          <div className="clients-search-wrap" style={{ padding: 0 }}>
            <Search size={14} className="clients-search-icon" style={{ left: 12 }} />
            <input className="clients-search-input" placeholder="Search forms..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="clients-list">
          <div
            className={`clients-list-item ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
            style={{ padding: '10px 16px' }}
          >
            <Globe size={14} style={{ color: '#0d9488', flexShrink: 0 }} />
            <div className="clients-item-info">
              <div className="clients-item-name" style={{ fontSize: 12 }}>All Categories</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 10 }}>
              {categories.length}
            </span>
          </div>
          {categories.map(c => (
            <div key={c.visaType}
              className={`clients-list-item ${selectedCategory === c.visaType ? 'active' : ''}`}
              onClick={() => setSelectedCategory(c.visaType)}
              style={{ padding: '10px 16px' }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: CATEGORY_COLORS[c.visaType] || '#6b7280' }} />
              <div className="clients-item-info">
                <div className="clients-item-name" style={{ fontSize: 12 }}>{c.visaType}</div>
                <div className="clients-item-meta">{c.forms.filter(f => f.uploaded).length}/{c.forms.length} uploaded</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 10 }}>
                {c.forms.length}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {categories.length} categories · {stats.totalForms || 0} forms
        </div>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <FolderOpen size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No forms found</div>
              <div style={{ fontSize: 13 }}>Try adjusting your search or category filter</div>
            </div>
          ) : (
            filtered.map(cat => (
              <div key={cat.visaType} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[cat.visaType] || '#6b7280' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{cat.visaType}</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {cat.forms.length} form{cat.forms.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {cat.forms.map(form => (
                    <div key={form.form_number} className="clients-detail-card" style={{
                      padding: 16, marginBottom: 0,
                      borderLeft: `3px solid ${form.uploaded ? '#10b981' : '#e5e7eb'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: CATEGORY_COLORS[cat.visaType] || '#6b7280', background: `${CATEGORY_COLORS[cat.visaType] || '#6b7280'}12`, padding: '2px 8px', borderRadius: 6 }}>
                          {form.form_number}
                        </span>
                        {form.uploaded ? <CheckCircle size={16} color="#10b981" /> : <Clock size={16} color="#9ca3af" />}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                        {form.name || form.form_number}
                      </div>
                      {form.field_mappings && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                          {Object.keys(form.field_mappings).length} field{Object.keys(form.field_mappings).length !== 1 ? 's' : ''} mapped
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {form.uploaded ? (
                          <>
                            <button className="btn btn-primary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                              onClick={() => setViewingForm({ formNumber: form.form_number, formName: form.name || form.form_number })}>
                              <Eye size={12} /> View / Edit
                            </button>
                            <a href={api.downloadIRCCTemplate(form.form_number)}
                              className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11 }}>
                              <Download size={12} />
                            </a>
                            <button className="btn btn-ghost btn-sm"
                              style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                              onClick={() => handleDelete(form.form_number)}>
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                            onClick={() => handleUpload(form.form_number, form.name, cat.visaType)}
                            disabled={uploading === form.form_number}>
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

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        {/* Template Stats */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Template Stats</div>
          <div className="clients-ctx-stat-row">
            <span>Visa Categories</span>
            <strong style={{ color: '#4f46e5' }}>{stats.totalCategories || 0}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Total Forms</span>
            <strong style={{ color: '#3b82f6' }}>{stats.totalForms || 0}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Uploaded</span>
            <strong style={{ color: '#10b981' }}>{stats.uploadedForms || 0}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Pending</span>
            <strong style={{ color: '#f59e0b' }}>{stats.pendingForms || 0}</strong>
          </div>
        </div>

        {/* Upload Progress */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Upload Progress</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{completionPct}% complete</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stats.uploadedForms || 0}/{stats.totalForms || 0}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completionPct}%`, background: 'linear-gradient(90deg, #10b981, #0d9488)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Selected Category Info */}
        {selectedCat && (
          <div className="clients-ctx-section">
            <div className="clients-ctx-label">Selected Category</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[selectedCat.visaType] || '#6b7280' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedCat.visaType}</span>
            </div>
            <div className="clients-ctx-stat-row">
              <span>Forms</span>
              <strong>{selectedCat.forms.length}</strong>
            </div>
            <div className="clients-ctx-stat-row">
              <span>Uploaded</span>
              <strong style={{ color: '#10b981' }}>{selectedCatUploaded}</strong>
            </div>
            <div className="clients-ctx-stat-row">
              <span>Pending</span>
              <strong style={{ color: '#f59e0b' }}>{selectedCat.forms.length - selectedCatUploaded}</strong>
            </div>
          </div>
        )}
      </div>

      {/* PDF Form Viewer Modal */}
      {viewingForm && (
        <PDFFormViewer
          formNumber={viewingForm.formNumber}
          formName={viewingForm.formName}
          onClose={() => setViewingForm(null)}
        />
      )}
    </div>
  );
}
