import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import FileUpload from '../components/FileUpload';
import Toast from '../components/Toast';
import PIFViewer from '../components/PIFViewer';
import Timeline from '../components/Timeline';
import NotesPanel from '../components/NotesPanel';
import DeadlineTracker from '../components/DeadlineTracker';
import DocumentChecklist from '../components/DocumentChecklist';
import EmailList from '../components/EmailList';
import IRCCFormGenerator from '../components/IRCCFormGenerator';
import FormEditor from '../components/FormEditor';
import WorkflowStages from '../components/WorkflowStages';
import SignatureManager from '../components/SignatureManager';
import TrustAccountPanel from '../components/TrustAccountPanel';
import TaskPanel from '../components/TaskPanel';
import OcrConfirmModal from '../components/OcrConfirmModal';
import { Globe, Mail, Phone, Pencil, X, Send, ClipboardList, FileText, PenTool, Key, CheckCircle, Clock, Upload, Download, Search, BarChart3, Save, Plus, Zap, Trash2, Image, BookOpen, Cake, MessageSquare, CalendarClock, ListChecks, Inbox, Stamp, Shield, ShieldCheck, ShieldAlert, Calendar, UserCheck, ChevronDown, ChevronUp, ScanLine, Wallet, Link2, CheckSquare } from 'lucide-react';

const VISA_COLORS = {
  'Express Entry':                   'badge-primary',
  'Study Permit':                    'badge-indigo',
  'Work Permit (PGWP)':             'badge-teal',
  'Work Permit (LMIA)':             'badge-teal',
  'Open Work Permit':                'badge-teal',
  'Spousal Sponsorship':             'badge-purple',
  'Parent/Grandparent Sponsorship':  'badge-purple',
  'PR Application':                  'badge-success',
  'PR Card Renewal':                 'badge-success',
  'Provincial Nominee (PNP)':        'badge-primary',
  'Atlantic Immigration (AIP)':      'badge-indigo',
  'IEC (Working Holiday)':           'badge-teal',
  'Visitor Visa (TRV)':             'badge-warning',
  'Super Visa':                      'badge-warning',
  'Citizenship Application':         'badge-success',
  'LMIA Application':                'badge-gray',
  'eTA':                             'badge-gray',
  'Refugee Claim':                   'badge-danger',
};

const PIF_META = {
  pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  label: 'PIF Pending',   Icon: Clock },
  sent:      { color: '#3b82f6', bg: 'rgba(59,130,246,.12)',  label: 'PIF Sent',      Icon: Send },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,.12)',  label: 'PIF Completed', Icon: CheckCircle },
};

const TABS = [
  { id: 'timeline',    label: 'Timeline',         Icon: Clock },
  { id: 'tasks',       label: 'Tasks',            Icon: CheckSquare },
  { id: 'notes',       label: 'Notes',            Icon: MessageSquare },
  { id: 'pif',         label: 'PIF Data',         Icon: ClipboardList },
  { id: 'docs-forms',  label: 'Documents & Forms', Icon: FileText },
  { id: 'signatures',  label: 'Signatures',       Icon: PenTool },
  { id: 'trust',       label: 'Trust Account',    Icon: Wallet },
  { id: 'data',        label: 'Client Data',      Icon: Key },
  { id: 'deadlines',   label: 'Deadlines',        Icon: CalendarClock },
  { id: 'checklist',   label: 'Doc Checklist',    Icon: ListChecks },
  { id: 'emails',      label: 'Emails',           Icon: Inbox },
];

const CATEGORIES = ['general','passport','identity','education','employment','financial','medical','letter','other'];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [toast, setToast] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
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
  const [ocrLoading, setOcrLoading] = useState(null); // doc id being processed
  const [sendingPortal, setSendingPortal] = useState(false);

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
  useEffect(() => {
    if (activeTab === 'documents') {
      api.getClientEmails(id).then(emails => {
        setEmailsWithAttachments(emails.filter(e => e.has_attachments));
      }).catch(() => {});
    }
  }, [activeTab, id]);

  /* ── Handlers ──────────────────────────────────────────── */
  const wrap = (fn, msg) => async (...args) => {
    setProcessing(true); setProcessingMsg(msg);
    try { await fn(...args); }
    catch (e) { setToast({ message: e.message || msg + ' failed', type: 'error' }); }
    setProcessing(false);
  };

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
  const handleSaveNameInline = async () => {
    try {
      await api.updateClient(id, { first_name: editForm.first_name, last_name: editForm.last_name });
      setEditingName(false);
      setToast({ message: 'Name updated!', type: 'success' });
      fetchClient();
    } catch (e) { setToast({ message: e.message, type: 'error' }); }
  };

  const handleSaveEdit = async () => {
    setProcessing(true); setProcessingMsg('Saving…');
    try { await api.updateClient(id, editForm); setEditing(false); setToast({ message: 'Client updated!', type: 'success' }); fetchClient(); }
    catch (e) { setToast({ message: e.message, type: 'error' }); }
    setProcessing(false);
  };
  const handleSaveClientData = async () => {
    try { await api.updateClientData(id, clientDataLocal); setToast({ message: 'Data saved!', type: 'success' }); fetchClient(); }
    catch { setToast({ message: 'Save failed', type: 'error' }); }
  };
  const handleDeleteDoc  = async (docId)  => { if (!confirm('Delete this document?')) return; await api.deleteDocument(docId);  fetchClient(); };
  const handleDeleteForm = async (formId) => { if (!confirm('Delete this form?'))     return; await api.deleteForm(formId);     fetchClient(); };
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
    try {
      const result = await api.ocrDocument(docId);
      setOcrData({ ...result, docId });
    } catch (e) {
      setToast({ message: `OCR failed: ${e.message}`, type: 'error' });
    }
    setOcrLoading(null);
  };

  const handleOcrConfirm = async (fields, updateClient) => {
    try {
      await api.confirmOcr(ocrData.docId, fields, updateClient);
      setToast({ message: `${Object.keys(fields).length} OCR fields saved`, type: 'success' });
      setOcrData(null);
      fetchClient();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleSendPortal = async () => {
    setSendingPortal(true);
    try {
      const res = await fetch(`/api/clients/${id}/send-portal`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToast({ message: data.simulated ? 'Portal link logged to console' : `Portal link sent to ${client.email}!`, type: data.simulated ? 'info' : 'success' });
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
    setSendingPortal(false);
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh' }}>
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
    <div className="page-enter cd-wrap">

      {/* ── Hero Header ────────────────────────────────────── */}
      <div className="cd-hero">
        <div className="cd-hero-left">
          <div className="cd-avatar">{initials}</div>
          <div className="cd-hero-info">
            {editingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text" className="form-input" autoFocus
                  value={editForm.first_name}
                  onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))}
                  style={{ fontSize: 20, fontWeight: 800, padding: '4px 10px', width: 160 }}
                  placeholder="First name"
                />
                <input
                  type="text" className="form-input"
                  value={editForm.last_name}
                  onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNameInline(); if (e.key === 'Escape') setEditingName(false); }}
                  style={{ fontSize: 20, fontWeight: 800, padding: '4px 10px', width: 160 }}
                  placeholder="Last name"
                />
                <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleSaveNameInline}><Save size={14} /> Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}><X size={14} /></button>
              </div>
            ) : (
              <div className="cd-hero-name" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => setEditingName(true)}
                title="Click to edit name">
                {client.first_name} {client.last_name}
                <Pencil size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              </div>
            )}
            <div className="cd-hero-meta">
              {client.nationality && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Globe size={14} /> {client.nationality}</span>}
              {client.email      && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Mail size={14} /> {client.email}</span>}
              {client.phone      && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Phone size={14} /> {client.phone}</span>}
            </div>
            <div className="cd-hero-badges">
              {client.visa_type && <span className={`badge ${visaBadge}`}>{client.visa_type}</span>}
              <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{client.status}</span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700,
                padding:'3px 10px', borderRadius:20, background: pif.bg, color: pif.color, border:`1px solid ${pif.color}44` }}>
                <pif.Icon size={12} /> {pif.label}
              </span>
            </div>
          </div>
        </div>

        <div className="cd-hero-actions">
          <button className="btn btn-secondary" style={{display:'flex',alignItems:'center',gap:6}} onClick={() => setEditing(e => !e)}>
            {editing ? <><X size={14} /> Cancel</> : <><Pencil size={14} /> Edit Client</>}
          </button>
          <button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleSendPif} disabled={sendingPif || !client.email}>
            <Send size={14} /> {sendingPif ? 'Sending…' : client.pif_status === 'completed' ? 'Resend PIF' : 'Send PIF Form'}
          </button>
          <button className="btn btn-secondary" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleSendPortal} disabled={sendingPortal || !client.email}>
            <Link2 size={14} /> {sendingPortal ? 'Sending…' : 'Portal Link'}
          </button>
          {client.forms?.length > 0 && (
            <button className="btn btn-success" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleFillAll}><Zap size={14} /> Auto-Fill All</button>
          )}
        </div>
      </div>

      {/* ── Stat Strip ─────────────────────────────────────── */}
      <div className="cd-stats">
        {[
          { Icon: FileText, val: docCount,   label:'Documents' },
          { Icon: PenTool, val: formCount,  label:'Forms' },
          { Icon: Key, val: clientDataLocal.length, label:'Data Fields' },
          { Icon: CheckCircle, val: client.filled_forms?.length||0, label:'Filled Forms' },
          { Icon: BookOpen, val: client.passport_number || '—', label:'Passport No.' },
          { Icon: Cake, val: client.date_of_birth  || '—', label:'Date of Birth' },
        ].map(s => (
          <div key={s.label} className="cd-stat-chip">
            <span className="cd-stat-icon" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><s.Icon size={18} /></span>
            <div>
              <div className="cd-stat-val">{s.val}</div>
              <div className="cd-stat-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Edit Panel ─────────────────────────────────────── */}
      {editing && (
        <div className="card cd-edit-panel">
          <div className="card-header">
            <div className="card-title" style={{display:'flex',alignItems:'center',gap:6}}><Pencil size={14} /> Edit Client</div>
          </div>
          <div className="form-grid">
            {Object.entries(editForm).map(([k, v]) => (
              k !== 'status' && (
                <div key={k} className={`form-group ${k === 'notes' ? 'form-full' : ''}`}>
                  <label className="form-label">{k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</label>
                  {k === 'notes' ? (
                    <textarea className="form-textarea" value={v} rows={3}
                      onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} />
                  ) : k === 'date_of_birth' ? (
                    <input type="date" className="form-input" value={v}
                      onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} />
                  ) : (
                    <input type="text" className="form-input" value={v}
                      onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} />
                  )}
                </div>
              )
            ))}
          </div>
          <div className="modal-footer" style={{marginTop:16}}>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleSaveEdit}><Save size={14} /> Save Changes</button>
          </div>
        </div>
      )}

      {/* ── Workflow Stages ──────────────────────────────────── */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <WorkflowStages client={client} />
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="cd-tabs">
        {TABS.map(t => {
          const count = t.id === 'docs-forms' ? (docCount + formCount + (client.filled_forms?.length||0))
            : t.id === 'data' ? clientDataLocal.length : null;
          return (
            <button key={t.id}
              className={`cd-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.id); }}>
              <t.Icon size={14} /> {t.label}
              {count !== null && (
                <span className="cd-tab-badge">{count}</span>
              )}
              {t.id === 'pif' && (
                <span style={{ marginLeft:6, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
                  background: pif.bg, color: pif.color }}>
                  {pif.label.replace('PIF ','').toUpperCase()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Timeline Tab ────────────────────────────────────── */}
      {activeTab === 'timeline' && <Timeline clientId={id} />}

      {/* ── Tasks Tab ──────────────────────────────────────── */}
      {activeTab === 'tasks' && <TaskPanel clientId={id} />}

      {/* ── Notes Tab ─────────────────────────────────────── */}
      {activeTab === 'notes' && <NotesPanel clientId={id} />}

      {/* ── PIF Tab ─────────────────────────────────────────── */}
      {activeTab === 'pif' && (
        <div>
          {pifLoading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : !pifData?.submitted ? (
            <div className="card" style={{padding:'60px 40px',textAlign:'center'}}>
              <div style={{width:72,height:72,borderRadius:16,background:'linear-gradient(135deg,#eef2ff,#e0e7ff)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
                <ClipboardList size={32} style={{color:'#4f46e5'}} />
              </div>
              <div style={{fontSize:20,fontWeight:800,color:'var(--text-primary)',marginBottom:8}}>PIF Not Yet Submitted</div>
              <div style={{fontSize:14,color:'var(--text-muted)',maxWidth:400,margin:'0 auto',lineHeight:1.6}}>
                {client.pif_status === 'sent'
                  ? 'The form link has been sent to the client. Waiting for them to complete and submit it.'
                  : 'Send the Personal Information Form link to the client so they can fill out their immigration details.'}
              </div>
              {client.pif_status === 'sent' && (
                <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:16,padding:'8px 16px',borderRadius:20,background:'#fffbeb',border:'1px solid #fde68a',color:'#b45309',fontSize:13,fontWeight:600}}>
                  <Clock size={14} /> Waiting for client response
                </div>
              )}
              {client.email && (
                <div style={{marginTop:20}}>
                  <button className="btn btn-primary" onClick={handleSendPif} disabled={sendingPif} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 24px',fontSize:14}}>
                    <Send size={16} /> {sendingPif ? 'Sending…' : client.pif_status === 'sent' ? 'Resend PIF Form' : 'Send PIF Form'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Summary Header Bar */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',background:'linear-gradient(135deg,#f0fdf4,#ecfdf5)',border:'1px solid #bbf7d0',borderRadius:12,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{width:42,height:42,borderRadius:10,background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <CheckCircle size={22} style={{color:'#059669'}} />
                  </div>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:'#065f46'}}>Personal Information Form</div>
                    <div style={{fontSize:12,color:'#047857',marginTop:2,display:'flex',alignItems:'center',gap:6}}>
                      <Calendar size={12} />
                      Submitted {new Date(pifData.submitted_at).toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <button className="btn btn-secondary btn-sm" onClick={handleVerifyPif} disabled={verifying}
                    style={{display:'inline-flex',alignItems:'center',gap:6,borderColor:'#c7d2fe',color:'#4338ca',background:'#eef2ff'}}>
                    {verifying ? (
                      <><span className="spin" style={{display:'inline-block'}}><Search size={13} /></span> Verifying…</>
                    ) : (
                      <><ShieldCheck size={14} /> Verify Against Docs</>
                    )}
                  </button>
                  {verificationResults && (
                    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:700,
                      background: Object.values(verificationResults).some(v => v.status === 'mismatch') ? '#fef2f2' : '#f0fdf4',
                      color: Object.values(verificationResults).some(v => v.status === 'mismatch') ? '#dc2626' : '#059669',
                      border: `1px solid ${Object.values(verificationResults).some(v => v.status === 'mismatch') ? '#fecaca' : '#bbf7d0'}`
                    }}>
                      {Object.values(verificationResults).some(v => v.status === 'mismatch')
                        ? <><ShieldAlert size={13} /> Issues Found</>
                        : <><ShieldCheck size={13} /> All Verified</>}
                    </span>
                  )}
                </div>
              </div>

              {/* PIF Viewer */}
              <PIFViewer data={pifData.data} verificationResults={verificationResults} clientDocuments={client.documents||[]} clientId={id} onDataSaved={(newData) => { setPifData(prev => ({ ...prev, data: newData })); setToast({ message: 'PIF data saved successfully', type: 'success' }); }} />
            </div>
          )}
        </div>
      )}

      {/* ── Documents & Forms Tab (Unified) ─────────────────── */}
      {activeTab === 'docs-forms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1: IRCC Forms */}
          <IRCCFormGenerator clientId={id} />

          {/* Section 2: Client Documents */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Client Documents
            </div>
            <FileUpload onFiles={setDocFiles} label="Drop client documents here (passport, ID, letters, education, etc.)" />
            {docFiles.length > 0 && (
              <div className="cd-upload-row">
                <select className="form-select" style={{width:180}} value={docCategory} onChange={e => setDocCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
                <button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleUploadDocs}><Upload size={14} /> Upload {docFiles.length} File(s)</button>
              </div>
            )}

            {docCount > 0 && (
              <div className="cd-action-banner" style={{marginTop:20}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:6}}><BarChart3 size={16} /> Extract All Document Data</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>Analyse all PDFs and auto-populate client data fields.</div>
                </div>
                <button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleExtractAll}><Search size={14} /> Extract All Data</button>
              </div>
            )}

            {extractionResults && (
              <div className="card" style={{marginTop:16}}>
                <div className="card-header">
                  <div className="card-title" style={{display:'flex',alignItems:'center',gap:6}}><BarChart3 size={14} /> Extraction Results</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setExtractionResults(null)}>Dismiss</button>
                </div>
                <div className="stats-grid" style={{marginBottom:12}}>
                  {[
                    {label:'Total Docs', val: extractionResults.summary.total_documents},
                    {label:'Text Extracted', val: extractionResults.summary.text_documents, color:'var(--accent-green)'},
                    {label:'Image Only', val: extractionResults.summary.image_documents, color:'var(--accent-amber)'},
                    {label:'Fields Found', val: extractionResults.summary.total_fields_extracted, color:'var(--primary)'},
                  ].map(s => (
                    <div key={s.label} className="stat-card">
                      <div className="stat-value" style={s.color?{color:s.color}:{}}>{s.val}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="table-wrap" style={{maxHeight:200,overflowY:'auto'}}>
                  <table><tbody>
                    {extractionResults.documents.map((d,i) => (
                      <tr key={i}>
                        <td style={{fontWeight:500}}>{d.original_name}</td>
                        <td><span className={`badge ${d.status==='extracted'?'badge-success':d.status==='image_only'?'badge-warning':'badge-danger'}`}>
                          {d.status==='extracted'?'Text':d.status==='image_only'?'Image':'Error'}
                        </span></td>
                        {d.fieldsExtracted>0 && <td><span className="badge badge-success">{d.fieldsExtracted} fields</span></td>}
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            )}

            {docCount > 0 && (
              <div className="card" style={{marginTop:20}}>
                <div className="card-header">
                  <div className="card-title" style={{display:'flex',alignItems:'center',gap:6}}><FileText size={14} /> Uploaded Documents</div>
                  <span className="badge badge-gray">{docCount} files</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
                    <tbody>
                      {client.documents.map(doc => (
                        <tr key={doc.id}>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{display:'flex'}}>{doc.original_name.endsWith('.pdf')?<FileText size={18} />:<Image size={18} />}</span>
                              <div>
                                <div style={{fontWeight:600,fontSize:13}}>{doc.original_name}</div>
                                <div style={{display:'flex',gap:5,marginTop:2}}>
                                  {doc.extracted_text && <span className="badge badge-success" style={{fontSize:10}}>Extracted</span>}
                                  {doc.source==='pif-upload' && <span className="badge badge-purple" style={{fontSize:10}}>Client Upload</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td><span className="badge badge-indigo">{doc.category||'general'}</span></td>
                          <td style={{color:'var(--text-muted)',fontSize:12}}>{(doc.file_size/1024).toFixed(0)} KB</td>
                          <td style={{color:'var(--text-muted)',fontSize:12}}>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{display:'flex',gap:6}}>
                              <a href={api.getDocumentDownloadUrl(doc.id)} className="btn btn-secondary btn-sm" style={{display:'flex',alignItems:'center'}} download><Download size={14} /></a>
                              {doc.original_name.toLowerCase().endsWith('.pdf') && (
                                <button className="btn btn-primary btn-sm" style={{display:'flex',alignItems:'center',gap:4}} onClick={() => handleExtract(doc.id)}><Search size={12} /> Extract</button>
                              )}
                              {/\.(png|jpg|jpeg|tiff|tif|bmp|webp)$/i.test(doc.original_name) && (
                                <button className="btn btn-secondary btn-sm" style={{display:'flex',alignItems:'center',gap:4}} onClick={() => handleOcr(doc.id)} disabled={ocrLoading === doc.id}>
                                  <ScanLine size={12} /> {ocrLoading === doc.id ? 'OCR…' : 'OCR'}
                                </button>
                              )}
                              <button className="btn btn-danger btn-sm" style={{display:'flex',alignItems:'center'}} onClick={() => handleDeleteDoc(doc.id)}><X size={14} /></button>
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

          {/* Section 3: Custom Forms (collapsible) */}
          <div>
            <div
              style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => setShowFieldMapper(prev => !prev && !formFieldsData ? false : prev)}
            >
              <PenTool size={16} /> Custom Forms Upload
              {formCount > 0 && <span className="badge badge-gray" style={{ marginLeft: 8 }}>{formCount}</span>}
            </div>
            <FileUpload onFiles={setFormFiles} accept=".pdf" label="Drop blank fillable PDF forms here" />
            {formFiles.length > 0 && (
              <div style={{marginTop:12}}>
                <button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleUploadForms}><Upload size={14} /> Upload {formFiles.length} Form(s)</button>
              </div>
            )}
            {formCount > 0 && (
              <>
                <div className="cd-action-banner cd-action-green" style={{marginTop:20}}>
                  <Zap size={14} /> <strong>Smart Fill:</strong>&nbsp;Clicking "Fill" will auto-extract data from all documents and populate the form.
                </div>
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header">
                    <div className="card-title" style={{display:'flex',alignItems:'center',gap:6}}><PenTool size={14} /> Uploaded Forms</div>
                    <span className="badge badge-gray">{formCount} forms</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Form</th><th>Fields</th><th>Uploaded</th><th>Actions</th></tr></thead>
                      <tbody>
                        {client.forms.map(form => (
                          <tr key={form.id}>
                            <td style={{fontWeight:600,display:'flex',alignItems:'center',gap:6}}><PenTool size={14} /> {form.original_name}</td>
                            <td><span className="badge badge-purple">{form.field_count} fields</span></td>
                            <td style={{color:'var(--text-muted)',fontSize:12}}>{new Date(form.uploaded_at).toLocaleDateString()}</td>
                            <td>
                              <div style={{display:'flex',gap:6}}>
                                <button className="btn btn-secondary btn-sm" style={{display:'flex',alignItems:'center',gap:4}} onClick={() => handleViewFields(form.id)}><Search size={12} /> Fields</button>
                                <button className="btn btn-success btn-sm" style={{display:'flex',alignItems:'center',gap:4}} onClick={() => handleFillForm(form.id)}><Zap size={12} /> Fill</button>
                                <button className="btn btn-danger btn-sm" style={{display:'flex',alignItems:'center'}} onClick={() => handleDeleteForm(form.id)}><X size={14} /></button>
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

          {/* Section 4: All Filled Forms */}
          {(client.filled_forms?.length > 0) && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} /> Completed Forms
                <span className="badge badge-success" style={{ marginLeft: 4 }}>{client.filled_forms.length}</span>
              </div>
              <div className="card">
                {client.filled_forms.map(ff => (
                  <div key={ff.id} className="cd-filled-row">
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:40,height:40,borderRadius:8,background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#10b981'}}><CheckCircle size={20} /></div>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>{ff.original_form_name||'Filled Form'}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Filled on {new Date(ff.filled_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-secondary btn-sm" style={{display:'flex',alignItems:'center',gap:4}} onClick={() => setSelectedFormForMapping(ff.id)}>
                        <Pencil size={12} /> Edit
                      </button>
                      <a href={api.getFilledFormDownloadUrl(ff.id)} className="btn btn-primary btn-sm" download style={{display:'flex',alignItems:'center',gap:4}}><Download size={14} /> Download</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Editor for filled forms from the "Completed Forms" section */}
          {selectedFormForMapping && typeof selectedFormForMapping === 'number' && !showFieldMapper && (
            <FormEditor
              filledFormId={selectedFormForMapping}
              clientId={id}
              onClose={() => setSelectedFormForMapping(null)}
              onSaved={() => { setSelectedFormForMapping(null); fetchClient(); }}
            />
          )}
        </div>
      )}

      {/* ── Data Tab ─────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div>
          <div className="cd-data-toolbar">
            <div style={{fontSize:13,color:'var(--text-muted)'}}>
              Key-value pairs used to auto-fill forms. Extract from documents or add manually.
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary" style={{display:'flex',alignItems:'center',gap:6}} onClick={() => setClientDataLocal(p => [...p, {field_key:'',field_value:'',source:'manual'}])}><Plus size={14} /> Add Field</button>
              <button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}} onClick={handleSaveClientData}><Save size={14} /> Save Data</button>
            </div>
          </div>

          {clientDataLocal.length === 0 ? (
            <div className="card"><div className="empty">
              <div className="empty-icon"><Key size={32} /></div>
              <div className="empty-title">No data yet</div>
              <div className="empty-text">Extract from documents or add fields manually.</div>
              {docCount > 0 && <button className="btn btn-primary" style={{marginTop:12,display:'flex',alignItems:'center',gap:6,margin:'12px auto 0'}} onClick={handleExtractAll}><Search size={14} /> Extract from Documents</button>}
            </div></div>
          ) : (
            <div className="card">
              <div className="cd-data-header">
                <span>Field Name</span><span>Value</span><span>Source</span><span></span>
              </div>
              {clientDataLocal.map((item, i) => (
                <div key={i} className="cd-data-row">
                  <input className="form-input" value={item.field_key} placeholder="e.g. passport_number"
                    onChange={e => { const a=[...clientDataLocal]; a[i]={...a[i],field_key:e.target.value}; setClientDataLocal(a); }} />
                  <input className="form-input" value={item.field_value} placeholder="Value…"
                    onChange={e => { const a=[...clientDataLocal]; a[i]={...a[i],field_value:e.target.value}; setClientDataLocal(a); }} />
                  <span className={`badge ${item.source==='extracted'?'badge-teal':'badge-purple'}`}>{item.source||'manual'}</span>
                  <button className="btn btn-danger btn-sm" style={{display:'flex',alignItems:'center'}} onClick={() => setClientDataLocal(p=>p.filter((_,j)=>j!==i))}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Deadlines Tab ────────────────────────────────────── */}
      {activeTab === 'deadlines' && <DeadlineTracker clientId={id} />}

      {/* ── Doc Checklist Tab ─────────────────────────────────── */}
      {activeTab === 'checklist' && <DocumentChecklist clientId={id} visaType={client.visa_type} />}

      {/* ── Emails Tab ────────────────────────────────────── */}
      {activeTab === 'emails' && <EmailList clientId={id} />}

      {/* ── Signatures Tab ─────────────────────────────────── */}
      {activeTab === 'signatures' && <SignatureManager clientId={id} />}

      {/* ── Trust Account Tab ──────────────────────────────── */}
      {activeTab === 'trust' && <TrustAccountPanel clientId={id} />}

      {/* ── OCR Confirm Modal ──────────────────────────────── */}
      {ocrData && (
        <OcrConfirmModal
          data={ocrData}
          onConfirm={handleOcrConfirm}
          onClose={() => setOcrData(null)}
        />
      )}

      {/* ── Retainers Tab ────────────────────────────────── */}
      {activeTab === 'retainers' && <RetainerPanel clientId={id} />}

      {/* ── Employer Tab ────────────────────────────────── */}
      {activeTab === 'employer' && <EmployerLink clientId={id} />}

      {activeTab === 'dependents' && <DependentsPanel clientId={id} clientName={client ? `${client.first_name} ${client.last_name}` : ''} />}

      {/* ── Family Tab ──────────────────────────────────── */}
      {activeTab === 'family' && <FamilyMembers clientId={id} />}

      {/* ── Field Mapper Modal ───────────────────────────────── */}
      {showFieldMapper && formFieldsData && (
        <div className="modal-overlay" onClick={() => setShowFieldMapper(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Form Fields — {formFieldsData.form_name}</div>
              <button className="modal-close" onClick={() => setShowFieldMapper(false)}><X size={18} /></button>
            </div>
            <p style={{color:'var(--text-muted)',fontSize:13,marginBottom:16}}>
              Fillable fields detected in the PDF. Matching client data will be auto-mapped.
            </p>
            {formFieldsData.fields.length === 0 ? (
              <div style={{textAlign:'center',color:'var(--text-muted)',padding:20}}>
                <p>No standard fillable fields detected.</p>
                <p style={{fontSize:12,marginTop:8}}>This may be an XFA form — text overlay will be used.</p>
              </div>
            ) : (
              <div className="table-wrap" style={{maxHeight:300,overflowY:'auto'}}>
                <table>
                  <thead><tr><th>Field Name</th><th>Type</th></tr></thead>
                  <tbody>
                    {formFieldsData.fields.map((f,i) => (
                      <tr key={i}>
                        <td style={{fontFamily:'monospace',fontSize:13,fontWeight:600}}>{f.name}</td>
                        <td><span className="badge badge-indigo">{f.type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFieldMapper(false)}>Close</button>
              <button className="btn btn-success" onClick={() => { setShowFieldMapper(false); handleFillForm(selectedFormForMapping); }} style={{display:'flex',alignItems:'center',gap:6}}><Zap size={14} /> Auto-Fill This Form</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Processing Overlay ────────────────────────────────── */}
      {processing && (
        <div className="processing-overlay">
          <div className="processing-content">
            <div className="spinner" />
            <div style={{fontSize:15,fontWeight:700,marginTop:12}}>Processing…</div>
            <div style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>{processingMsg}</div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
