import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import FileUpload from './FileUpload';
import Toast from './Toast';
import PIFViewer from './PIFViewer';
import Timeline from './Timeline';
import NotesPanel from './NotesPanel';
import DeadlineTracker from './DeadlineTracker';
import DocumentChecklist from './DocumentChecklist';
import EmailList from './EmailList';
import IRCCFormGenerator from './IRCCFormGenerator';
import FormEditor from './FormEditor';
import PDFFormViewer from './PDFFormViewer';
import WorkflowStages from './WorkflowStages';
import SignatureManager from './SignatureManager';
import TrustAccountPanel from './TrustAccountPanel';
import TaskPanel from './TaskPanel';
import OcrConfirmModal from './OcrConfirmModal';
import AuditLog from './AuditLog';
import {
  Globe, Mail, Phone, Pencil, X, Send, ClipboardList, FileText, PenTool, Key,
  CheckCircle, Clock, Upload, Download, Search, BarChart3, Save, Plus, Zap,
  Trash2, Image, BookOpen, Cake, MessageSquare, CalendarClock, ListChecks,
  Inbox, Stamp, Shield, ShieldCheck, ShieldAlert, Calendar, UserCheck,
  ScanLine, Wallet, Link2, CheckSquare, Eye, History
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
  { id: 'notes', label: 'Notes', Icon: MessageSquare },
  { id: 'pif', label: 'PIF Data', Icon: ClipboardList },
  { id: 'docs-forms', label: 'Documents & Forms', Icon: FileText },
  { id: 'signatures', label: 'Signatures', Icon: PenTool },
  { id: 'trust', label: 'Trust Account', Icon: Wallet },
  { id: 'data', label: 'Client Data', Icon: Key },
  { id: 'deadlines', label: 'Deadlines', Icon: CalendarClock },
  { id: 'checklist', label: 'Doc Checklist', Icon: ListChecks },
  { id: 'emails', label: 'Emails', Icon: Inbox },
  { id: 'ircc-forms', label: 'IRCC Forms', Icon: Stamp },
  { id: 'audit', label: 'Audit Log', Icon: History },
];

const CATEGORIES = ['general','passport','identity','education','employment','financial','medical','letter','other'];

export default function ClientDetailCenter({ clientId, onClientUpdated }) {
  const { user } = useAuth();
  const id = clientId;
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [toast, setToast] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [editForm, setEditForm] = useState({});
  const [docFiles, setDocFiles] = useState([]);
  const [formFiles, setFormFiles] = useState([]);
  const [docCategory, setDocCategory] = useState('general');
  const [clientDataLocal, setClientDataLocal] = useState([]);
  const [showFieldMapper, setShowFieldMapper] = useState(false);
  const [selectedFormForMapping, setSelectedFormForMapping] = useState(null);
  const [formFieldsData, setFormFieldsData] = useState(null);
  const [extractionResults, setExtractionResults] = useState(null);
  const [pifData, setPifData] = useState(null);
  const [pifLoading, setPifLoading] = useState(false);
  const [sendingPif, setSendingPif] = useState(false);
  const [verificationResults, setVerificationResults] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(null);
  const [sendingPortal, setSendingPortal] = useState(false);
  const [irccTemplates, setIrccTemplates] = useState([]);
  const [irccTemplatesLoading, setIrccTemplatesLoading] = useState(false);
  const [viewingIrccForm, setViewingIrccForm] = useState(null);

  const fetchClient = useCallback(async () => {
    try {
      const data = await api.getClient(id);
      setClient(data);
      setClientDataLocal(data.client_data || []);
      setEditForm({
        first_name: data.first_name, last_name: data.last_name,
        email: data.email || '', phone: data.phone || '',
        nationality: data.nationality || '', date_of_birth: data.date_of_birth || '',
        passport_number: data.passport_number || '', visa_type: data.visa_type || '',
        notes: data.notes || '', status: data.status || 'active',
      });
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

  const fetchIrccTemplates = useCallback(async () => {
    if (!client?.visa_type) return;
    setIrccTemplatesLoading(true);
    try {
      const data = await api.getIRCCTemplatesByType(client.visa_type);
      setIrccTemplates((data.forms || []).filter(f => f.uploaded));
    } catch { setIrccTemplates([]); }
    setIrccTemplatesLoading(false);
  }, [client?.visa_type]);

  useEffect(() => { if (activeTab === 'docs-forms' && client?.visa_type && irccTemplates.length === 0) fetchIrccTemplates(); }, [activeTab, client?.visa_type]);

  // Handlers
  const handleUploadDocs = async () => {
    if (!docFiles.length) return;
    setProcessing(true); setProcessingMsg('Uploading documents…');
    try { await api.uploadDocuments(id, docFiles, docCategory); setDocFiles([]); setToast({ message: 'Documents uploaded!', type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleUploadForms = async () => {
    if (!formFiles.length) return;
    setProcessing(true); setProcessingMsg('Uploading forms…');
    try { await api.uploadForms(id, formFiles); setFormFiles([]); setToast({ message: 'Forms uploaded!', type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleExtract = async (docId) => {
    setProcessing(true); setProcessingMsg('Extracting data…');
    try { const r = await api.extractDocument(docId); setToast({ message: `Extracted ${Object.keys(r.data||{}).length} fields`, type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleExtractAll = async () => {
    setProcessing(true); setProcessingMsg('Processing all documents…');
    try { const r = await api.extractAllDocuments(id); setExtractionResults(r); setToast({ message: `${r.summary.total_fields_extracted} fields extracted from ${r.summary.total_documents} docs`, type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleFillForm = async (formId) => {
    setProcessing(true); setProcessingMsg('Auto-filling form…');
    try { const r = await api.fillForm(formId); setToast({ message: `${r.fields_filled}/${r.fields_total} fields filled`, type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleFillAll = async () => {
    setProcessing(true); setProcessingMsg('Filling all forms…');
    try { const rs = await api.fillAllForms(id); setToast({ message: `${rs.filter(r=>!r.error).length}/${rs.length} forms filled`, type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleViewFields = async (formId) => {
    try { const d = await api.getFormFields(formId); setFormFieldsData(d); setSelectedFormForMapping(formId); setShowFieldMapper(true); }
    catch { setToast({ message: 'Failed to load fields', type: 'error' }); }
  };
  const handleSaveEdit = async (fields) => {
    setProcessing(true); setProcessingMsg('Saving…');
    try { await api.updateClient(id, fields); setToast({ message: 'Client updated!', type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleSaveClientData = async () => {
    try { await api.updateClientData(id, clientDataLocal); setToast({ message: 'Data saved!', type: 'success' }); fetchClient(); }
    catch { setToast({ message: 'Save failed', type: 'error' }); }
  };
  const handleDeleteDoc = async (docId) => { if (!confirm('Delete this document?')) return; await api.deleteDocument(docId); fetchClient(); };
  const handleDeleteForm = async (formId) => { if (!confirm('Delete this form?')) return; await api.deleteForm(formId); fetchClient(); };
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
  const handleOcr = async (docId) => {
    setOcrLoading(docId);
    try { const result = await api.ocrDocument(docId); setOcrData({ ...result, docId }); }
    catch (e) { setToast({ message: `OCR failed: ${e.message}`, type: 'error' }); }
    setOcrLoading(null);
  };
  const handleOcrConfirm = async (fields, updateClient) => {
    try { await api.confirmOcr(ocrData.docId, fields, updateClient); setToast({ message: `${Object.keys(fields).length} OCR fields saved`, type: 'success' }); setOcrData(null); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
  };
  const handleSendPortal = async () => {
    setSendingPortal(true);
    try {
      const res = await fetch(`/api/clients/${id}/send-portal`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToast({ message: data.simulated ? 'Portal link logged to console' : `Portal link sent to ${client.email}!`, type: data.simulated ? 'info' : 'success' });
    } catch (e) { setToast({ message: e.message, type: 'error' }); }
    setSendingPortal(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div className="spinner" />
    </div>
  );
  if (!client) return <div className="empty">Client not found.</div>;

  const initials = `${client.first_name?.[0]||''}${client.last_name?.[0]||''}`.toUpperCase();
  const pif = PIF_META[client.pif_status] || PIF_META.pending;
  const visaBadge = VISA_COLORS[client.visa_type] || 'badge-gray';
  const docCount = client.documents?.length || 0;
  const formCount = client.forms?.length || 0;

  return (
    <>
      {/* Hero Header (compact for center panel) */}
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
          <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleSendPif} disabled={sendingPif || !client.email}>
            <Send size={13} /> {sendingPif ? 'Sending…' : 'Send PIF'}
          </button>
          {client.forms?.length > 0 && (
            <button className="btn btn-success btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleFillAll}>
              <Zap size={13} /> Auto-Fill
            </button>
          )}
        </div>
      </div>

      {/* Workflow Stages with editable fields */}
      <div className="clients-detail-card">
        <WorkflowStages client={client} editMode={true} onSave={handleSaveEdit} />
      </div>

      {/* Tabs */}
      <div className="cd-tabs" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-base)', paddingTop: 4 }}>
        {TABS.map(t => {
          const count = t.id === 'docs-forms' ? (docCount + formCount + (client.filled_forms?.length||0))
            : t.id === 'data' ? clientDataLocal.length : null;
          return (
            <button key={t.id}
              className={`cd-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              <t.Icon size={14} /> {t.label}
              {count !== null && <span className="cd-tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && <Timeline clientId={id} />}
      {activeTab === 'tasks' && <TaskPanel clientId={id} />}
      {activeTab === 'notes' && <NotesPanel clientId={id} />}

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
                  {verifying ? <><Search size={13} /> Verifying…</> : <><ShieldCheck size={14} /> Verify</>}
                </button>
              </div>
              <PIFViewer data={pifData.data} verificationResults={verificationResults} clientDocuments={client.documents||[]} clientId={id} userRole={user?.role} onDataSaved={(newData) => { setPifData(prev => ({ ...prev, data: newData })); setToast({ message: 'PIF data saved', type: 'success' }); }} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'docs-forms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <IRCCFormGenerator clientId={id} />

          {/* IRCC Form Templates — View & Auto-Fill with PIF Data */}
          {irccTemplates.length > 0 && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stamp size={16} /> IRCC Form Templates (View & Auto-Fill)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                Open uploaded PDF templates pre-filled with {client.first_name}'s PIF data. Edit fields and download.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {irccTemplates.map(form => (
                  <div key={form.form_number} className="card" style={{ padding: 14, borderLeft: '3px solid #4f46e5' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#4f46e5', marginBottom: 4 }}>{form.form_number}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.3 }}>
                      {form.name || form.form_number}
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
                      onClick={() => setViewingIrccForm({ formNumber: form.form_number, formName: form.name || form.form_number })}>
                      <Eye size={12} /> View & Fill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {irccTemplatesLoading && (
            <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" /></div>
          )}

          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Client Documents
            </div>
            <FileUpload onFiles={setDocFiles} label="Drop client documents here" />
            {docFiles.length > 0 && (
              <div className="cd-upload-row">
                <select className="form-select" style={{ width: 180 }} value={docCategory} onChange={e => setDocCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleUploadDocs}><Upload size={14} /> Upload {docFiles.length} File(s)</button>
              </div>
            )}
            {docCount > 0 && (
              <div className="cd-action-banner" style={{ marginTop: 20 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={16} /> Extract All Document Data</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Analyse all PDFs and auto-populate client data fields.</div>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleExtractAll}><Search size={14} /> Extract All</button>
              </div>
            )}
            {docCount > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header">
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Uploaded Documents</div>
                  <span className="badge badge-gray">{docCount} files</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Actions</th></tr></thead>
                    <tbody>
                      {client.documents.map(doc => (
                        <tr key={doc.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {doc.original_name.endsWith('.pdf') ? <FileText size={18} /> : <Image size={18} />}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.original_name}</div>
                                <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                                  {doc.extracted_text && <span className="badge badge-success" style={{ fontSize: 10 }}>Extracted</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td><span className="badge badge-indigo">{doc.category||'general'}</span></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(doc.file_size/1024).toFixed(0)} KB</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <a href={api.getDocumentDownloadUrl(doc.id)} className="btn btn-secondary btn-sm" download><Download size={14} /></a>
                              {doc.original_name.toLowerCase().endsWith('.pdf') && (
                                <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleExtract(doc.id)}><Search size={12} /> Extract</button>
                              )}
                              {/\.(png|jpg|jpeg|tiff|tif|bmp|webp)$/i.test(doc.original_name) && (
                                <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleOcr(doc.id)} disabled={ocrLoading === doc.id}>
                                  <ScanLine size={12} /> {ocrLoading === doc.id ? 'OCR…' : 'OCR'}
                                </button>
                              )}
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}><X size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Custom Forms */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PenTool size={16} /> Custom Forms Upload
              {formCount > 0 && <span className="badge badge-gray" style={{ marginLeft: 8 }}>{formCount}</span>}
            </div>
            <FileUpload onFiles={setFormFiles} accept=".pdf" label="Drop blank fillable PDF forms here" />
            {formFiles.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleUploadForms}><Upload size={14} /> Upload {formFiles.length} Form(s)</button>
              </div>
            )}
            {formCount > 0 && (
              <>
                <div className="cd-action-banner cd-action-green" style={{ marginTop: 20 }}>
                  <Zap size={14} /> <strong>Smart Fill:</strong>&nbsp;Click "Fill" to auto-populate the form.
                </div>
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="card-header">
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PenTool size={14} /> Uploaded Forms</div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Form</th><th>Fields</th><th>Actions</th></tr></thead>
                      <tbody>
                        {client.forms.map(form => (
                          <tr key={form.id}>
                            <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><PenTool size={14} /> {form.original_name}</td>
                            <td><span className="badge badge-purple">{form.field_count} fields</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewFields(form.id)}><Search size={12} /> Fields</button>
                                <button className="btn btn-success btn-sm" onClick={() => handleFillForm(form.id)}><Zap size={12} /> Fill</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteForm(form.id)}><X size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Filled Forms */}
          {(client.filled_forms?.length > 0) && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} /> Completed Forms
                <span className="badge badge-success" style={{ marginLeft: 4 }}>{client.filled_forms.length}</span>
              </div>
              <div className="card">
                {client.filled_forms.map(ff => (
                  <div key={ff.id} className="cd-filled-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}><CheckCircle size={20} /></div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{ff.original_form_name||'Filled Form'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Filled on {new Date(ff.filled_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedFormForMapping(ff.id)}><Pencil size={12} /> Edit</button>
                      <a href={api.getFilledFormDownloadUrl(ff.id)} className="btn btn-primary btn-sm" download><Download size={14} /> Download</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFormForMapping && typeof selectedFormForMapping === 'number' && !showFieldMapper && (
            <FormEditor filledFormId={selectedFormForMapping} clientId={id} onClose={() => setSelectedFormForMapping(null)} onSaved={() => { setSelectedFormForMapping(null); fetchClient(); }} />
          )}
        </div>
      )}

      {activeTab === 'data' && (
        <div>
          <div className="cd-data-toolbar">
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Key-value pairs for auto-filling forms.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setClientDataLocal(p => [...p, { field_key: '', field_value: '', source: 'manual' }])}><Plus size={14} /> Add Field</button>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleSaveClientData}><Save size={14} /> Save Data</button>
            </div>
          </div>
          {clientDataLocal.length === 0 ? (
            <div className="card"><div className="empty">
              <div className="empty-icon"><Key size={32} /></div>
              <div className="empty-title">No data yet</div>
              <div className="empty-text">Extract from documents or add fields manually.</div>
            </div></div>
          ) : (
            <div className="card">
              <div className="cd-data-header"><span>Field Name</span><span>Value</span><span>Source</span><span></span></div>
              {clientDataLocal.map((item, i) => (
                <div key={i} className="cd-data-row">
                  <input className="form-input" value={item.field_key} placeholder="e.g. passport_number"
                    onChange={e => { const a=[...clientDataLocal]; a[i]={...a[i],field_key:e.target.value}; setClientDataLocal(a); }} />
                  <input className="form-input" value={item.field_value} placeholder="Value…"
                    onChange={e => { const a=[...clientDataLocal]; a[i]={...a[i],field_value:e.target.value}; setClientDataLocal(a); }} />
                  <span className={`badge ${item.source==='extracted'?'badge-teal':'badge-purple'}`}>{item.source||'manual'}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => setClientDataLocal(p=>p.filter((_,j)=>j!==i))}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'deadlines' && <DeadlineTracker clientId={id} />}
      {activeTab === 'checklist' && <DocumentChecklist clientId={id} visaType={client.visa_type} />}
      {activeTab === 'emails' && <EmailList clientId={id} />}
      {activeTab === 'signatures' && <SignatureManager clientId={id} />}
      {activeTab === 'trust' && <TrustAccountPanel clientId={id} />}
      {activeTab === 'ircc-forms' && <IRCCFormGenerator clientId={id} />}
      {activeTab === 'audit' && <AuditLog clientId={id} />}

      {/* Modals */}
      {ocrData && <OcrConfirmModal data={ocrData} onConfirm={handleOcrConfirm} onClose={() => setOcrData(null)} />}

      {showFieldMapper && formFieldsData && (
        <div className="modal-overlay" onClick={() => setShowFieldMapper(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Form Fields — {formFieldsData.form_name}</div>
              <button className="modal-close" onClick={() => setShowFieldMapper(false)}><X size={18} /></button>
            </div>
            <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Field Name</th><th>Type</th></tr></thead>
                <tbody>
                  {formFieldsData.fields.map((f,i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{f.name}</td>
                      <td><span className="badge badge-indigo">{f.type}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFieldMapper(false)}>Close</button>
              <button className="btn btn-success" onClick={() => { setShowFieldMapper(false); handleFillForm(selectedFormForMapping); }}><Zap size={14} /> Auto-Fill</button>
            </div>
          </div>
        </div>
      )}

      {/* IRCC Form Viewer with Auto-Fill */}
      {viewingIrccForm && (
        <PDFFormViewer
          formNumber={viewingIrccForm.formNumber}
          formName={viewingIrccForm.formName}
          clientId={id}
          clientName={`${client.first_name} ${client.last_name}`}
          onClose={() => setViewingIrccForm(null)}
        />
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
