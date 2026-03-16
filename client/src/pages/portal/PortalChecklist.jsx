import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Circle, Upload, AlertCircle, FolderOpen } from 'lucide-react';

const CATEGORY_LABELS = {
  identity: 'Identity Documents',
  language: 'Language Tests',
  education: 'Education',
  employment: 'Employment',
  background: 'Background Checks',
  medical: 'Medical',
  financial: 'Financial',
  forms: 'Forms',
  relationship: 'Relationship',
  other: 'Other',
  general: 'General',
};

export default function PortalChecklist({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null); // checklist item id being uploaded
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);
  const uploadItemRef = useRef(null);

  const load = () => {
    fetch(`/api/portal/${token}/checklist`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const handleUploadClick = (itemId) => {
    uploadItemRef.current = itemId;
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files.length || !uploadItemRef.current) return;

    setUploading(uploadItemRef.current);
    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    formData.append('checklist_item_id', uploadItemRef.current);

    try {
      const res = await fetch(`/api/portal/${token}/documents`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        setToast('Document uploaded successfully!');
        load();
      } else {
        setToast(result.error || 'Upload failed');
      }
    } catch {
      setToast('Upload failed');
    } finally {
      setUploading(null);
      e.target.value = '';
      setTimeout(() => setToast(''), 3000);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  if (!data) return null;

  return (
    <div>
      {/* Hidden file input */}
      <input type="file" ref={fileRef} onChange={handleFileChange} style={{ display: 'none' }} multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" />

      {/* Progress bar */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1a1a2e' }}>Document Checklist</h2>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#6366f1' }}>
            {data.completed}/{data.total} ({data.progress}%)
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: data.progress === 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            width: `${data.progress}%`, transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Items by category */}
      {Object.entries(data.grouped).map(([category, items]) => (
        <div key={category} style={{
          background: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderOpen size={16} style={{ color: '#6366f1' }} />
            {CATEGORY_LABELS[category] || category}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', background: '#f8fafc', borderRadius: 10,
                border: `1px solid ${item.status === 'uploaded' ? 'rgba(16,185,129,0.3)' : item.status === 'waived' ? 'rgba(245,158,11,0.3)' : '#e2e8f0'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {item.status === 'uploaded' ? (
                    <CheckCircle size={20} color="#10b981" />
                  ) : item.status === 'waived' ? (
                    <AlertCircle size={20} color="#f59e0b" />
                  ) : (
                    <Circle size={20} color="#cbd5e1" />
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a2e' }}>
                      {item.document_name}
                      {item.is_required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{item.description}</div>
                    )}
                    {item.uploaded_filename && (
                      <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>
                        ✓ {item.uploaded_filename}
                      </div>
                    )}
                  </div>
                </div>
                {item.status === 'missing' && (
                  <button
                    onClick={() => handleUploadClick(item.id)}
                    disabled={uploading === item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', border: 'none', borderRadius: 8,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      opacity: uploading === item.id ? 0.6 : 1,
                    }}
                  >
                    <Upload size={14} />
                    {uploading === item.id ? 'Uploading...' : 'Upload'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 20px',
          background: '#1a1a2e', color: '#fff', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
