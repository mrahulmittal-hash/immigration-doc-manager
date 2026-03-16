import { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Trash2, Download } from 'lucide-react';

export default function PortalDocuments({ token }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  const load = () => {
    fetch(`/api/portal/${token}/documents`)
      .then(r => r.json())
      .then(data => setDocs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch(`/api/portal/${token}/documents`, { method: 'POST', body: formData });
      const result = await res.json();
      if (result.success) {
        setToast('Documents uploaded!');
        load();
      } else {
        setToast(result.error || 'Upload failed');
      }
    } catch {
      setToast('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      const res = await fetch(`/api/portal/${token}/documents/${docId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) load();
      else setToast(result.error || 'Delete failed');
    } catch {
      setToast('Delete failed');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;

  return (
    <div>
      <input type="file" ref={fileRef} onChange={handleUpload} style={{ display: 'none' }} multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.tiff" />

      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          background: '#fff', borderRadius: 16, padding: 40, marginBottom: 24,
          border: '2px dashed #d1d5db', textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}
        onMouseOver={e => e.currentTarget.style.borderColor = '#6366f1'}
        onMouseOut={e => e.currentTarget.style.borderColor = '#d1d5db'}
      >
        <Upload size={32} color="#6366f1" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e', margin: '0 0 4px' }}>
          {uploading ? 'Uploading...' : 'Click to upload documents'}
        </p>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
          PDF, images, or Word documents up to 50MB
        </p>
      </div>

      {/* Document list */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#1a1a2e' }}>
          Your Documents ({docs.length})
        </h3>

        {docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
            <FileText size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ fontSize: 14, margin: 0 }}>No documents uploaded yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => (
              <div key={doc.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#f8fafc', borderRadius: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileText size={18} color="#6366f1" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a2e' }}>{doc.original_name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {formatSize(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 12px', border: 'none', borderRadius: 8,
                      background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                      fontSize: 12, cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
