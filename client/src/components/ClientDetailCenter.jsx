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
  History, X,
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
