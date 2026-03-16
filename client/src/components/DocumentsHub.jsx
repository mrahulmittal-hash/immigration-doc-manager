import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import FileUpload from './FileUpload';
import DocumentChecklist from './DocumentChecklist';
import SignatureManager from './SignatureManager';
import PDFRenderer from './PDFRenderer';
import {
  FileText, Upload, Download, Search, BarChart3, X, Image, ScanLine,
  PenTool, Zap, CheckCircle, Pencil, ListChecks, Eye, ChevronRight,
} from 'lucide-react';

const CATEGORIES = ['general','passport','identity','education','employment','financial','medical','letter','other'];
const SECTIONS = [
  { id: 'required', label: 'Required Docs', Icon: ListChecks },
  { id: 'all', label: 'All Documents', Icon: FileText },
  { id: 'signatures', label: 'Signatures', Icon: PenTool },
];

export default function DocumentsHub({ clientId, client, onRefresh, onToast, onProcessing }) {
  const [section, setSection] = useState('all');
  const [docFiles, setDocFiles] = useState([]);
  const [formFiles, setFormFiles] = useState([]);
  const [docCategory, setDocCategory] = useState('general');
  const [viewingDoc, setViewingDoc] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(null);

  const docCount = client?.documents?.length || 0;
  const formCount = client?.forms?.length || 0;

  const handleUploadDocs = async () => {
    if (!docFiles.length) return;
    onProcessing?.(true, 'Uploading documents…');
    try { await api.uploadDocuments(clientId, docFiles, docCategory); setDocFiles([]); onToast?.('Documents uploaded!', 'success'); onRefresh?.(); }
    catch (e) { onToast?.(e.message, 'error'); }
    onProcessing?.(false);
  };

  const handleUploadForms = async () => {
    if (!formFiles.length) return;
    onProcessing?.(true, 'Uploading forms…');
    try { await api.uploadForms(clientId, formFiles); setFormFiles([]); onToast?.('Forms uploaded!', 'success'); onRefresh?.(); }
    catch (e) { onToast?.(e.message, 'error'); }
    onProcessing?.(false);
  };

  const handleExtract = async (docId) => {
    onProcessing?.(true, 'Extracting data…');
    try { const r = await api.extractDocument(docId); onToast?.(`Extracted ${Object.keys(r.data||{}).length} fields`, 'success'); onRefresh?.(); }
    catch (e) { onToast?.(e.message, 'error'); }
    onProcessing?.(false);
  };

  const handleExtractAll = async () => {
    onProcessing?.(true, 'Processing all documents…');
    try { const r = await api.extractAllDocuments(clientId); onToast?.(`${r.summary.total_fields_extracted} fields extracted from ${r.summary.total_documents} docs`, 'success'); onRefresh?.(); }
    catch (e) { onToast?.(e.message, 'error'); }
    onProcessing?.(false);
  };

  const handleFillForm = async (formId) => {
    onProcessing?.(true, 'Auto-filling form…');
    try { const r = await api.fillForm(formId); onToast?.(`${r.fields_filled}/${r.fields_total} fields filled`, 'success'); onRefresh?.(); }
    catch (e) { onToast?.(e.message, 'error'); }
    onProcessing?.(false);
  };

  const handleDeleteDoc = async (docId) => { if (!confirm('Delete this document?')) return; await api.deleteDocument(docId); onRefresh?.(); };
  const handleDeleteForm = async (formId) => { if (!confirm('Delete this form?')) return; await api.deleteForm(formId); onRefresh?.(); };

  const handleOcr = async (docId) => {
    setOcrLoading(docId);
    try { await api.ocrDocument(docId); onToast?.('OCR complete', 'success'); onRefresh?.(); }
    catch (e) { onToast?.(`OCR failed: ${e.message}`, 'error'); }
    setOcrLoading(null);
  };

  return (
    <div>
      {/* Section pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {SECTIONS.map(s => (
          <button key={s.id}
            onClick={() => setSection(s.id)}
            className={`filter-pill ${section === s.id ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 14px' }}>
            <s.Icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      {/* Required Documents (Checklist) */}
      {section === 'required' && (
        <DocumentChecklist clientId={clientId} visaType={client?.visa_type} />
      )}

      {/* All Documents */}
      {section === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Document Upload */}
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
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleUploadDocs}>
                  <Upload size={14} /> Upload {docFiles.length} File(s)
                </button>
              </div>
            )}
          </div>

          {/* Extract All */}
          {docCount > 0 && (
            <div className="cd-action-banner">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={16} /> Extract All Document Data</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Analyse all PDFs and auto-populate client data fields.</div>
              </div>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleExtractAll}><Search size={14} /> Extract All</button>
            </div>
          )}

          {/* Document List */}
          {docCount > 0 && (
            <div className="card">
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
                              {doc.extracted_text && <span className="badge badge-success" style={{ fontSize: 10 }}>Extracted</span>}
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-indigo">{doc.category||'general'}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(doc.file_size/1024).toFixed(0)} KB</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {doc.original_name.toLowerCase().endsWith('.pdf') && (
                              <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => setViewingDoc(viewingDoc === doc.id ? null : doc.id)}>
                                <Eye size={12} /> View
                              </button>
                            )}
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

              {/* Inline PDF Viewer */}
              {viewingDoc && (
                <div style={{
                  background: '#1e293b', borderRadius: 8, margin: '12px 16px', padding: 0,
                  height: 500, overflow: 'hidden', position: 'relative',
                }}>
                  <button onClick={() => setViewingDoc(null)}
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                  <PDFRenderer url={api.getDocumentDownloadUrl(viewingDoc)} />
                </div>
              )}
            </div>
          )}

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
            )}
          </div>

          {/* Completed/Filled Forms */}
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
                    <a href={api.getFilledFormDownloadUrl(ff.id)} className="btn btn-primary btn-sm" download><Download size={14} /> Download</a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signatures */}
      {section === 'signatures' && (
        <SignatureManager clientId={clientId} />
      )}
    </div>
  );
}
