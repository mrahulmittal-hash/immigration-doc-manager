import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import FileUpload from '../components/FileUpload';
import Toast from '../components/Toast';
import PIFViewer from '../components/PIFViewer';

const VISA_COLORS = {
  'Express Entry':        'badge-primary',
  'Study Permit':         'badge-indigo',
  'Work Permit (PGWP)':   'badge-teal',
  'Spousal Sponsorship':  'badge-purple',
  'PR Application':       'badge-success',
  'Visitor Visa (TRV)':   'badge-warning',
};

const PIF_META = {
  pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  label: 'PIF Pending',   icon: '⏳' },
  sent:      { color: '#3b82f6', bg: 'rgba(59,130,246,.12)',  label: 'PIF Sent',      icon: '📨' },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,.12)',  label: 'PIF Completed', icon: '✅' },
};

const TABS = [
  { id: 'pif',       label: 'PIF Data',      icon: '📋' },
  { id: 'documents', label: 'Documents',     icon: '📄' },
  { id: 'forms',     label: 'Forms',         icon: '📝' },
  { id: 'data',      label: 'Client Data',   icon: '🔑' },
  { id: 'filled',    label: 'Filled Forms',  icon: '✅' },
];

const CATEGORIES = ['general','passport','identity','education','employment','financial','medical','letter','other'];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pif');
  const [toast, setToast] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [editing, setEditing] = useState(false);
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
            <div className="cd-hero-name">{client.first_name} {client.last_name}</div>
            <div className="cd-hero-meta">
              {client.nationality && <span>🌍 {client.nationality}</span>}
              {client.email      && <span>✉ {client.email}</span>}
              {client.phone      && <span>📞 {client.phone}</span>}
            </div>
            <div className="cd-hero-badges">
              {client.visa_type && <span className={`badge ${visaBadge}`}>{client.visa_type}</span>}
              <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{client.status}</span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700,
                padding:'3px 10px', borderRadius:20, background: pif.bg, color: pif.color, border:`1px solid ${pif.color}44` }}>
                {pif.icon} {pif.label}
              </span>
            </div>
          </div>
        </div>

        <div className="cd-hero-actions">
          <button className="btn btn-secondary" onClick={() => setEditing(e => !e)}>
            {editing ? '✕ Cancel' : '✏️ Edit Client'}
          </button>
          <button className="btn btn-primary" onClick={handleSendPif} disabled={sendingPif || !client.email}>
            {sendingPif ? '📨 Sending…' : client.pif_status === 'completed' ? '📋 Resend PIF' : '📨 Send PIF Form'}
          </button>
          {client.forms?.length > 0 && (
            <button className="btn btn-success" onClick={handleFillAll}>⚡ Auto-Fill All</button>
          )}
        </div>
      </div>

      {/* ── Stat Strip ─────────────────────────────────────── */}
      <div className="cd-stats">
        {[
          { icon:'📄', val: docCount,   label:'Documents' },
          { icon:'📝', val: formCount,  label:'Forms' },
          { icon:'🔑', val: clientDataLocal.length, label:'Data Fields' },
          { icon:'✅', val: client.filled_forms?.length||0, label:'Filled Forms' },
          { icon:'📘', val: client.passport_number || '—', label:'Passport No.' },
          { icon:'🎂', val: client.date_of_birth  || '—', label:'Date of Birth' },
        ].map(s => (
          <div key={s.label} className="cd-stat-chip">
            <span className="cd-stat-icon">{s.icon}</span>
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
            <div className="card-title">✏️ Edit Client</div>
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
            <button className="btn btn-primary" onClick={handleSaveEdit}>💾 Save Changes</button>
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="cd-tabs">
        {TABS.map(t => {
          const count = t.id === 'documents' ? docCount : t.id === 'forms' ? formCount
            : t.id === 'data' ? clientDataLocal.length : t.id === 'filled' ? (client.filled_forms?.length||0) : null;
          return (
            <button key={t.id}
              className={`cd-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.id); }}>
              {t.icon} {t.label}
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

      {/* ── PIF Tab ─────────────────────────────────────────── */}
      {activeTab === 'pif' && (
        <div>
          {pifLoading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : !pifData?.submitted ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon">📋</div>
                <div className="empty-title">PIF not yet submitted</div>
                <div className="empty-text">
                  {client.pif_status === 'sent'
                    ? 'The form link has been sent. Waiting for the client to complete it.'
                    : 'Send the PIF form link to the client so they can fill out their personal information.'}
                </div>
                {client.email && (
                  <button className="btn btn-primary" style={{marginTop:16}} onClick={handleSendPif} disabled={sendingPif}>
                    {sendingPif ? '📨 Sending…' : '📨 Send PIF Form'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="card cd-pif-bar">
                <div>
                  <div style={{fontSize:15,fontWeight:700}}>Personal Information Form</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>
                    Submitted {new Date(pifData.submitted_at).toLocaleString()}
                  </div>
                </div>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <button className="btn btn-secondary btn-sm" onClick={handleVerifyPif} disabled={verifying}>
                    {verifying ? 'Verifying…' : '🔍 Verify Data'}
                  </button>
                  <span className="badge badge-success">✅ Completed</span>
                </div>
              </div>
              <PIFViewer data={pifData.data} verificationResults={verificationResults} clientDocuments={client.documents||[]} />
            </div>
          )}
        </div>
      )}

      {/* ── Documents Tab ───────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div>
          <FileUpload onFiles={setDocFiles} label="Drop client documents here (passport, ID, letters, education, etc.)" />
          {docFiles.length > 0 && (
            <div className="cd-upload-row">
              <select className="form-select" style={{width:180}} value={docCategory} onChange={e => setDocCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
              <button className="btn btn-primary" onClick={handleUploadDocs}>⬆️ Upload {docFiles.length} File(s)</button>
            </div>
          )}

          {docCount > 0 && (
            <div className="cd-action-banner" style={{marginTop:20}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>📊 Extract All Document Data</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>
                  Analyse all PDFs and auto-populate client data fields.
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleExtractAll}>🔍 Extract All Data</button>
            </div>
          )}

          {extractionResults && (
            <div className="card" style={{marginTop:16}}>
              <div className="card-header">
                <div className="card-title">📊 Extraction Results</div>
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
                        {d.status==='extracted'?'✓ Text':d.status==='image_only'?'🖼 Image':'✗ Error'}
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
                <div className="card-title">📄 Uploaded Documents</div>
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
                            <span style={{fontSize:18}}>{doc.original_name.endsWith('.pdf')?'📄':'🖼️'}</span>
                            <div>
                              <div style={{fontWeight:600,fontSize:13}}>{doc.original_name}</div>
                              <div style={{display:'flex',gap:5,marginTop:2}}>
                                {doc.extracted_text && <span className="badge badge-success" style={{fontSize:10}}>✓ Extracted</span>}
                                {doc.source==='pif-upload' && <span className="badge badge-purple" style={{fontSize:10}}>📎 Client Upload</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-indigo">{doc.category||'general'}</span></td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{(doc.file_size/1024).toFixed(0)} KB</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{display:'flex',gap:6}}>
                            <a href={api.getDocumentDownloadUrl(doc.id)} className="btn btn-secondary btn-sm" download>⬇️</a>
                            {doc.original_name.toLowerCase().endsWith('.pdf') && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleExtract(doc.id)}>🔍 Extract</button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>✕</button>
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
      )}

      {/* ── Forms Tab ────────────────────────────────────────── */}
      {activeTab === 'forms' && (
        <div>
          <FileUpload onFiles={setFormFiles} accept=".pdf" label="Drop blank fillable PDF forms here" />
          {formFiles.length > 0 && (
            <div style={{marginTop:12}}>
              <button className="btn btn-primary" onClick={handleUploadForms}>⬆️ Upload {formFiles.length} Form(s)</button>
            </div>
          )}

          {formCount > 0 && (
            <>
              <div className="cd-action-banner cd-action-green" style={{marginTop:20}}>
                ⚡ <strong>Smart Fill:</strong>&nbsp;Clicking "Fill" will auto-extract data from all documents and populate the form.
              </div>
              <div className="card" style={{marginTop:16}}>
                <div className="card-header">
                  <div className="card-title">📝 Uploaded Forms</div>
                  <span className="badge badge-gray">{formCount} forms</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Form</th><th>Fields</th><th>Uploaded</th><th>Actions</th></tr></thead>
                    <tbody>
                      {client.forms.map(form => (
                        <tr key={form.id}>
                          <td style={{fontWeight:600}}>📝 {form.original_name}</td>
                          <td><span className="badge badge-purple">{form.field_count} fields</span></td>
                          <td style={{color:'var(--text-muted)',fontSize:12}}>{new Date(form.uploaded_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{display:'flex',gap:6}}>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleViewFields(form.id)}>🔍 Fields</button>
                              <button className="btn btn-success btn-sm" onClick={() => handleFillForm(form.id)}>⚡ Fill</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteForm(form.id)}>✕</button>
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
      )}

      {/* ── Data Tab ─────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div>
          <div className="cd-data-toolbar">
            <div style={{fontSize:13,color:'var(--text-muted)'}}>
              Key-value pairs used to auto-fill forms. Extract from documents or add manually.
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary" onClick={() => setClientDataLocal(p => [...p, {field_key:'',field_value:'',source:'manual'}])}>➕ Add Field</button>
              <button className="btn btn-primary" onClick={handleSaveClientData}>💾 Save Data</button>
            </div>
          </div>

          {clientDataLocal.length === 0 ? (
            <div className="card"><div className="empty">
              <div className="empty-icon">🔑</div>
              <div className="empty-title">No data yet</div>
              <div className="empty-text">Extract from documents or add fields manually.</div>
              {docCount > 0 && <button className="btn btn-primary" style={{marginTop:12}} onClick={handleExtractAll}>🔍 Extract from Documents</button>}
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
                  <button className="btn btn-danger btn-sm" onClick={() => setClientDataLocal(p=>p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filled Forms Tab ─────────────────────────────────── */}
      {activeTab === 'filled' && (
        <div>
          {!client.filled_forms?.length ? (
            <div className="card"><div className="empty">
              <div className="empty-icon">✅</div>
              <div className="empty-title">No filled forms yet</div>
              <div className="empty-text">Upload blank forms, add client data, then click "Auto-Fill" to generate pre-filled PDFs.</div>
            </div></div>
          ) : (
            <div className="card">
              {client.filled_forms.map(ff => (
                <div key={ff.id} className="cd-filled-row">
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:40,height:40,borderRadius:8,background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>✅</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:13}}>{ff.original_form_name||'Filled Form'}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Filled on {new Date(ff.filled_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <a href={api.getFilledFormDownloadUrl(ff.id)} className="btn btn-primary btn-sm" download>⬇️ Download</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Field Mapper Modal ───────────────────────────────── */}
      {showFieldMapper && formFieldsData && (
        <div className="modal-overlay" onClick={() => setShowFieldMapper(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Form Fields — {formFieldsData.form_name}</div>
              <button className="modal-close" onClick={() => setShowFieldMapper(false)}>✕</button>
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
              <button className="btn btn-success" onClick={() => { setShowFieldMapper(false); handleFillForm(selectedFormForMapping); }}>⚡ Auto-Fill This Form</button>
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
