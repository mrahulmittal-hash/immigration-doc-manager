import { useState, useEffect } from 'react';
import { PenTool, Send, Copy, Download, Trash2, Plus, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import { api } from '../api';

const STATUS_STYLES = {
  pending: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: Clock, label: 'Pending' },
  sent: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', icon: Send, label: 'Sent' },
  signed: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: CheckCircle, label: 'Signed' },
  expired: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: AlertCircle, label: 'Expired' },
};

const DOC_TYPES = [
  { value: 'retainer_agreement', label: 'Retainer Agreement' },
  { value: 'imm_5476', label: 'IMM 5476 — Use of Representative' },
  { value: 'custom', label: 'Custom Document' },
];

export default function SignatureManager({ clientId }) {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState('retainer_agreement');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    try {
      const data = await api.getSignatures(clientId);
      setSignatures(data);
    } catch (err) {
      console.error('Failed to load signatures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await api.createSignatureRequest(clientId, {
        document_type: newType,
        document_name: newName || undefined,
      });
      showToast('Signature request created');
      setShowCreate(false);
      setNewType('retainer_agreement');
      setNewName('');
      load();
    } catch (err) {
      showToast('Failed to create request');
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (sigId) => {
    try {
      await api.sendSignatureRequest(clientId, sigId);
      showToast('Signature email sent!');
      load();
    } catch (err) {
      showToast(err.message || 'Failed to send email');
    }
  };

  const handleCopyLink = (signToken) => {
    const url = `${window.location.origin}/sign/${signToken}`;
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard');
  };

  const handleDelete = async (sigId) => {
    if (!confirm('Delete this signature request?')) return;
    try {
      await api.deleteSignatureRequest(sigId);
      load();
    } catch (err) {
      showToast('Failed to delete');
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading signatures...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PenTool size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>E-Signatures</h3>
          <span className="badge badge-primary" style={{ fontSize: 11 }}>{signatures.length}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Request Signature
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card" style={{ padding: 20, marginBottom: 16, border: '1px solid var(--primary)', borderRadius: 12 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>New Signature Request</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Document Type</label>
              <select className="form-input" value={newType} onChange={e => setNewType(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Custom Name (optional)</label>
              <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Leave blank for default" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Signatures list */}
      {signatures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <PenTool size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>No signature requests yet</p>
          <p style={{ fontSize: 12 }}>Create a request for retainer agreements or IMM 5476 forms</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {signatures.map(sig => {
            const style = STATUS_STYLES[sig.status] || STATUS_STYLES.pending;
            const Icon = style.icon;
            return (
              <div key={sig.id} className="card" style={{ padding: 16, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{sig.document_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {sig.document_type.replace(/_/g, ' ')} • Created {new Date(sig.created_at).toLocaleDateString()}
                      </div>
                      {sig.signed_at && (
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>
                          Signed on {new Date(sig.signed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: style.bg, color: style.color,
                  }}>
                    <Icon size={12} />
                    {style.label}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  {sig.status !== 'signed' && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleSend(sig.id)} title="Send email">
                        <Send size={13} /> Email
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleCopyLink(sig.sign_token)} title="Copy link">
                        <Copy size={13} /> Copy Link
                      </button>
                    </>
                  )}
                  {sig.status === 'signed' && (
                    <a
                      href={`/api/sign/download/${sig.id}`}
                      className="btn btn-ghost btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      <Download size={13} /> Download
                    </a>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(sig.id)} style={{ color: '#ef4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 20px',
          background: '#1a1a2e', color: '#fff', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'fadeIn 0.3s ease'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
