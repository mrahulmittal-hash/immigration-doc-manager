import { useState, useEffect } from 'react';
import { FileText, Eye, Download, Clock, CheckCircle, X, Mail, Send, Loader } from 'lucide-react';
import { api } from '../api';

export default function RetainerAgreementGenerator({ clientId, retainerId }) {
  const [agreements, setAgreements] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [emailMsg, setEmailMsg] = useState('');

  useEffect(() => { loadAgreements(); }, [clientId]);

  async function loadAgreements() {
    try {
      const rows = await api.getClientRetainerAgreements(clientId);
      setAgreements(rows);
    } catch (err) { console.error(err); }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await api.generateRetainerAgreement(clientId, { retainer_id: retainerId });
      setPreviewHtml(res.html);
      setShowPreview(true);
      await loadAgreements();
    } catch (err) { console.error('Generation error:', err); }
    setGenerating(false);
  }

  async function handleView(id) {
    try {
      const agreement = await api.getRetainerAgreement(id);
      setPreviewHtml(agreement.generated_html);
      setShowPreview(true);
    } catch (err) { console.error(err); }
  }

  async function handleSendEmail(agreementId) {
    setSendingEmail(agreementId);
    setEmailMsg('');
    try {
      const res = await api.sendRetainerAgreementEmail(agreementId);
      setEmailMsg(res.message || 'Agreement sent successfully!');
      await loadAgreements();
    } catch (err) {
      setEmailMsg(err.message || 'Failed to send email');
    }
    setSendingEmail(null);
    setTimeout(() => setEmailMsg(''), 4000);
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Retainer Agreement</title><style>body{font-family:Arial,sans-serif;margin:40px;font-size:13px;line-height:1.7;color:#1a1a1a}h1{font-size:20px}h3{font-size:14px}ul{padding-left:24px}@media print{body{margin:20px}}</style></head><body>${previewHtml}</body></html>`);
    win.document.close();
    win.print();
  }

  const statusColors = { draft: '#f59e0b', sent: '#3b82f6', signed: '#10b981' };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>RETAINER AGREEMENTS</span>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <FileText size={13} /> {generating ? 'Generating...' : 'Generate Agreement'}
        </button>
      </div>

      {agreements.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>No agreements generated yet</div>
      )}

      {agreements.map(agr => (
        <div key={agr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-subtle)', marginBottom: 4, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontWeight: 600 }}>Agreement #{agr.id}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {new Date(agr.generated_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: statusColors[agr.status] || 'var(--text-muted)', textTransform: 'capitalize' }}>
              {agr.status === 'signed' ? <CheckCircle size={12} style={{ verticalAlign: 'middle' }} /> : <Clock size={12} style={{ verticalAlign: 'middle' }} />}
              {' '}{agr.status || 'draft'}
            </span>
            <button onClick={() => handleView(agr.id)} title="View" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 2 }}>
              <Eye size={14} />
            </button>
            <button
              onClick={() => handleSendEmail(agr.id)}
              disabled={sendingEmail === agr.id}
              title="Send via Email"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 2 }}
            >
              {sendingEmail === agr.id ? <Loader size={14} className="spin" /> : <Mail size={14} />}
            </button>
          </div>
        </div>
      ))}

      {emailMsg && (
        <div style={{
          marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          background: emailMsg.includes('sent') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: emailMsg.includes('sent') ? '#10b981' : '#ef4444',
        }}>
          {emailMsg}
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '90%', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>Retainer Agreement</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={handlePrint} style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Download size={14} /> Print / PDF
                </button>
                {agreements.length > 0 && (
                  <button
                    className="btn"
                    onClick={() => handleSendEmail(agreements[0].id)}
                    disabled={!!sendingEmail}
                    style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                  >
                    {sendingEmail ? <Loader size={14} className="spin" /> : <Send size={14} />} Email to Client
                  </button>
                )}
                <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
              <div style={{ background: '#fff', padding: 40, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
