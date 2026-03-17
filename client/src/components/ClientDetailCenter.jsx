import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Toast from './Toast';
import PIFViewer from './PIFViewer';
import Timeline from './Timeline';
import EmailList from './EmailList';
import IRCCFormGenerator from './IRCCFormGenerator';
import WorkflowStages from './WorkflowStages';
import TaskPanel from './TaskPanel';
import DocumentsHub from './DocumentsHub';
import AccountingPanel from './AccountingPanel';
import AuditLog from './AuditLog';
import {
  Send, ClipboardList, FileText,
  CheckCircle, Clock, Inbox, Stamp, Wallet, CheckSquare,
  History, X, FileSignature, Download, Mail, Loader, Eye,
} from 'lucide-react';

const VISA_COLORS = {
  'Express Entry': 'badge-primary', 'Study Permit': 'badge-indigo',
  'Work Permit (PGWP)': 'badge-teal', 'Work Permit (LMIA)': 'badge-teal',
  'Open Work Permit': 'badge-teal', 'Spousal Sponsorship': 'badge-purple',
  'Parent/Grandparent Sponsorship': 'badge-purple', 'PR Application': 'badge-success',
  'PR Card Renewal': 'badge-success', 'Provincial Nominee (PNP)': 'badge-primary',
  'Atlantic Immigration (AIP)': 'badge-indigo', 'IEC (Working Holiday)': 'badge-teal',
  'Visitor Visa (TRV)': 'badge-warning', 'Super Visa': 'badge-warning',
  'Citizenship Application': 'badge-success', 'LMIA Application': 'badge-gray',
  'eTA': 'badge-gray', 'Refugee Claim': 'badge-danger',
};

const PIF_META = {
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: 'PIF Pending', Icon: Clock },
  sent: { color: '#3b82f6', bg: 'rgba(59,130,246,.12)', label: 'PIF Sent', Icon: Send },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,.12)', label: 'PIF Completed', Icon: CheckCircle },
};

const TABS = [
  { id: 'timeline', label: 'Timeline', Icon: Clock },
  { id: 'tasks', label: 'Tasks', Icon: CheckSquare },
  { id: 'pif', label: 'PIF Data', Icon: ClipboardList },
  { id: 'documents', label: 'Documents', Icon: FileText },
  { id: 'ircc-forms', label: 'IRCC Forms', Icon: Stamp },
  { id: 'accounting', label: 'Accounting', Icon: Wallet },
  { id: 'emails', label: 'Emails', Icon: Inbox },
];

export default function ClientDetailCenter({ clientId, onClientUpdated }) {
  const { user } = useAuth();
  const id = clientId;
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [toast, setToast] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [pifData, setPifData] = useState(null);
  const [pifLoading, setPifLoading] = useState(false);
  const [sendingPif, setSendingPif] = useState(false);
  const [verificationResults, setVerificationResults] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showRetainerModal, setShowRetainerModal] = useState(false);
  const [retainerAgreements, setRetainerAgreements] = useState([]);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);
  const [retainerPreviewHtml, setRetainerPreviewHtml] = useState('');
  const [sendingAgreementEmail, setSendingAgreementEmail] = useState(null);
  const [sendingForSigning, setSendingForSigning] = useState(null);
  const [agreementMsg, setAgreementMsg] = useState('');

  const fetchClient = useCallback(async () => {
    try {
      const data = await api.getClient(id);
      setClient(data);
      if (onClientUpdated) onClientUpdated(data);
    } catch { setToast({ message: 'Failed to load client', type: 'error' }); }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  const fetchPifData = useCallback(async () => {
    setPifLoading(true);
    try { const d = await api.getPIFData(id); setPifData(d); }
    catch { setPifData(null); }
    setPifLoading(false);
  }, [id]);

  useEffect(() => { if (activeTab === 'pif' && !pifData) fetchPifData(); }, [activeTab]);

  const handleSaveEdit = async (fields) => {
    setProcessing(true); setProcessingMsg('Saving…');
    try { await api.updateClient(id, fields); setToast({ message: 'Client updated!', type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };

  const handleSendPif = async () => {
    if (!window.confirm(`Send PIF form to ${client.email}?`)) return;
    setSendingPif(true);
    try { const r = await api.sendPIFEmail(id); setToast({ message: r.simulated ? 'PIF link logged to server console' : `PIF sent to ${client.email}!`, type: r.simulated ? 'info' : 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setSendingPif(false);
  };

  const handleVerifyPif = async () => {
    setVerifying(true);
    try { const r = await api.verifyPIFData(id); setVerificationResults(r.results); setToast({ message: 'Verification complete', type: 'success' }); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setVerifying(false);
  };

  /* ── Retainer Agreement handlers ── */
  const loadRetainerAgreements = useCallback(async () => {
    try { const rows = await api.getClientRetainerAgreements(id); setRetainerAgreements(rows); } catch {}
  }, [id]);

  const handleOpenRetainerModal = async () => {
    setShowRetainerModal(true);
    await loadRetainerAgreements();
  };

  const handleGenerateAgreement = async () => {
    setGeneratingAgreement(true);
    try {
      const res = await api.generateRetainerAgreement(id, {});
      setRetainerPreviewHtml(res.html);
      await loadRetainerAgreements();
    } catch (e) { setToast({ message: e.message || 'Failed to generate agreement', type: 'error' }); }
    setGeneratingAgreement(false);
  };

  const handleViewAgreement = async (agrId) => {
    try {
      const agreement = await api.getRetainerAgreement(agrId);
      setRetainerPreviewHtml(agreement.generated_html);
    } catch (e) { setToast({ message: e.message || 'Failed to load agreement', type: 'error' }); }
  };

  const handleSendAgreementEmail = async (agrId) => {
    if (!window.confirm(`Send retainer agreement via email to ${client?.email}?`)) return;
    setSendingAgreementEmail(agrId);
    setAgreementMsg('');
    try {
      const res = await api.sendRetainerAgreementEmail(agrId);
      setAgreementMsg(res.message || 'Agreement sent successfully!');
      await loadRetainerAgreements();
    } catch (e) { setAgreementMsg(e.message || 'Failed to send email'); }
    setSendingAgreementEmail(null);
    setTimeout(() => setAgreementMsg(''), 4000);
  };

  const handleSendForSigning = async (agrId) => {
    if (!window.confirm(`Send retainer agreement for signing to ${client?.email}?`)) return;
    setSendingForSigning(agrId);
    setAgreementMsg('');
    try {
      const res = await api.sendAgreementForSigning(agrId);
      setAgreementMsg(res.message || 'Agreement sent for signing!');
      await loadRetainerAgreements();
      fetchClient();
    } catch (e) { setAgreementMsg(e.message || 'Failed to send for signing'); }
    setSendingForSigning(null);
    setTimeout(() => setAgreementMsg(''), 4000);
  };

  const handlePrintAgreement = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Retainer Agreement</title><style>body{font-family:Arial,sans-serif;margin:40px;font-size:13px;line-height:1.7;color:#1a1a1a}h1{font-size:20px}h3{font-size:14px}ul{padding-left:24px}@media print{body{margin:20px}}</style></head><body>${retainerPreviewHtml}</body></html>`);
    win.document.close();
    win.print();
  };

  const handleProcessing = (on, msg) => { setProcessing(on); setProcessingMsg(msg || ''); };
  const handleToast = (message, type) => setToast({ message, type });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div className="spinner" />
    </div>
  );
  if (!client) return <div className="empty">Client not found.</div>;

  const initials = `${client.first_name?.[0]||''}${client.last_name?.[0]||''}`.toUpperCase();
  const pif = PIF_META[client.pif_status] || PIF_META.pending;
  const visaBadge = VISA_COLORS[client.visa_type] || 'badge-gray';

  return (
    <>
      {/* Hero Header */}
      <div className="clients-detail-card" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, #0d9488, #0f766e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 900, color: '#fff',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {client.first_name} {client.last_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {client.visa_type && <span className={`badge ${visaBadge}`}>{client.visa_type}</span>}
            <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{client.status}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 20, background: pif.bg, color: pif.color,
              border: `1px solid ${pif.color}44`,
            }}>
              <pif.Icon size={12} /> {pif.label}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAudit(true)} title="Audit Log"
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
            <History size={15} />
          </button>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleOpenRetainerModal}>
            <FileSignature size={13} /> Retainer Agreement
          </button>
          <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleSendPif} disabled={sendingPif || !client.email}>
            <Send size={13} /> {sendingPif ? 'Sending…' : 'Send PIF'}
          </button>
        </div>
      </div>

      {/* Workflow Stages */}
      <div className="clients-detail-card">
        <WorkflowStages client={client} editMode={true} onSave={handleSaveEdit} />
      </div>

      {/* Tabs */}
      <div className="cd-tabs" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-base)', paddingTop: 4 }}>
        {TABS.map(t => (
          <button key={t.id}
            className={`cd-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && <Timeline clientId={id} />}
      {activeTab === 'tasks' && <TaskPanel clientId={id} />}

      {activeTab === 'pif' && (
        <div>
          {pifLoading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : !pifData?.submitted ? (
            <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: 16, background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <ClipboardList size={32} style={{ color: '#4f46e5' }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>PIF Not Yet Submitted</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                {client.pif_status === 'sent' ? 'The form link has been sent. Waiting for the client to complete it.' : 'Send the PIF link to the client to fill out their immigration details.'}
              </div>
              {client.email && (
                <div style={{ marginTop: 20 }}>
                  <button className="btn btn-primary" onClick={handleSendPif} disabled={sendingPif} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 14 }}>
                    <Send size={16} /> {sendingPif ? 'Sending…' : client.pif_status === 'sent' ? 'Resend PIF Form' : 'Send PIF Form'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)', border: '1px solid #bbf7d0', borderRadius: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={22} style={{ color: '#059669' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#065f46' }}>Personal Information Form</div>
                    <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                      Submitted {new Date(pifData.submitted_at).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleVerifyPif} disabled={verifying} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {verifying ? 'Verifying…' : 'Verify'}
                </button>
              </div>
              <PIFViewer data={pifData.data} verificationResults={verificationResults} clientDocuments={client.documents||[]} clientId={id} userRole={user?.role} onDataSaved={(newData) => { setPifData(prev => ({ ...prev, data: newData })); setToast({ message: 'PIF data saved', type: 'success' }); }} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <DocumentsHub clientId={id} client={client} onRefresh={fetchClient} onToast={handleToast} onProcessing={handleProcessing} />
      )}

      {activeTab === 'ircc-forms' && <IRCCFormGenerator clientId={id} />}
      {activeTab === 'accounting' && <AccountingPanel clientId={id} />}
      {activeTab === 'emails' && <EmailList clientId={id} />}

      {/* Retainer Agreement Modal */}
      {showRetainerModal && (
        <div className="modal-overlay" onClick={() => { setShowRetainerModal(false); setRetainerPreviewHtml(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 960, width: '92%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSignature size={18} /> Retainer Agreements
              </h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary btn-sm" onClick={handleGenerateAgreement} disabled={generatingAgreement}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px' }}>
                  <FileText size={14} /> {generatingAgreement ? 'Generating…' : 'Generate New'}
                </button>
                {retainerPreviewHtml && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={handlePrintAgreement}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '6px 12px' }}>
                      <Download size={14} /> Print / PDF
                    </button>
                    {retainerAgreements.length > 0 && (
                      <>
                        <button className="btn btn-sm" onClick={() => handleSendForSigning(retainerAgreements[0].id)}
                          disabled={!!sendingForSigning || retainerAgreements[0].status === 'signed'}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                          {sendingForSigning ? <Loader size={14} className="spin" /> : <FileSignature size={14} />}
                          {sendingForSigning ? 'Sending…' : 'Send for Signing'}
                        </button>
                        <button className="btn btn-sm" onClick={() => handleSendAgreementEmail(retainerAgreements[0].id)}
                          disabled={!!sendingAgreementEmail}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                          {sendingAgreementEmail ? <Loader size={14} className="spin" /> : <Send size={14} />} Email to Client
                        </button>
                      </>
                    )}
                  </>
                )}
                <button onClick={() => { setShowRetainerModal(false); setRetainerPreviewHtml(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: agreement list */}
              <div style={{ width: 260, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 16, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Generated Agreements ({retainerAgreements.length})
                </div>
                {retainerAgreements.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 10px' }}>
                    No agreements yet. Click "Generate New" to create one.
                  </div>
                )}
                {retainerAgreements.map(agr => {
                  const statusColor = agr.status === 'signed' ? '#10b981' : agr.status === 'sent' ? '#3b82f6' : '#f59e0b';
                  const statusLabel = agr.status === 'sent' && agr.signing_provider ? `Sent (${agr.signing_provider === 'docusign' ? 'DocuSign' : 'Built-in'})` : agr.status || 'draft';
                  return (
                    <div key={agr.id} style={{
                      padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                      background: 'var(--bg-subtle)', cursor: 'pointer',
                      border: '1px solid var(--border)', transition: 'all .15s',
                    }}
                      onClick={() => handleViewAgreement(agr.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Agreement #{agr.id}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, textTransform: 'uppercase' }}>
                          {agr.status === 'signed' ? <CheckCircle size={10} /> : <Clock size={10} />} {statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(agr.generated_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                        {agr.signed_at && <span style={{ marginLeft: 6, color: '#10b981' }}>Signed {new Date(agr.signed_at).toLocaleDateString('en-CA')}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button onClick={e => { e.stopPropagation(); handleViewAgreement(agr.id); }} title="View"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 2 }}>
                          <Eye size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleSendForSigning(agr.id); }}
                          disabled={sendingForSigning === agr.id || agr.status === 'signed'} title="Send for Signing"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: 2 }}>
                          {sendingForSigning === agr.id ? <Loader size={13} className="spin" /> : <FileSignature size={13} />}
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleSendAgreementEmail(agr.id); }}
                          disabled={sendingAgreementEmail === agr.id} title="Send via Email"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 2 }}>
                          {sendingAgreementEmail === agr.id ? <Loader size={13} className="spin" /> : <Mail size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {agreementMsg && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: agreementMsg.includes('sent') || agreementMsg.includes('success') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
                    color: agreementMsg.includes('sent') || agreementMsg.includes('success') ? '#10b981' : '#ef4444',
                  }}>
                    {agreementMsg}
                  </div>
                )}
              </div>

              {/* Right: preview */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {retainerPreviewHtml ? (
                  <div style={{ background: '#fff', padding: 40, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: retainerPreviewHtml }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    <FileSignature size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <div style={{ fontSize: 16, fontWeight: 700 }}>No Preview</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Generate a new agreement or click one from the list to preview it.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Slide-Over */}
      {showAudit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => setShowAudit(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)' }} />
          <div style={{
            position: 'relative', width: 520, maxWidth: '90vw', height: '100%',
            background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
            overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={18} /> Audit Log
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAudit(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <AuditLog clientId={id} />
            </div>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {processing && (
        <div className="processing-overlay">
          <div className="processing-content">
            <div className="spinner" />
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>Processing…</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{processingMsg}</div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
