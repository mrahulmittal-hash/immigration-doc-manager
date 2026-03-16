import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  X, Download, FileText, AlertTriangle, CheckCircle, Loader,
  Eye, Edit3, RotateCcw
} from 'lucide-react';

const FIELD_SECTIONS = {
  personal: {
    label: 'Personal Information',
    color: '#4f46e5',
    keys: ['FamilyName', 'GivenName', 'GivenNames', 'ApplicantFamilyName', 'ApplicantGivenName',
      'ApplicantGivenNames', 'SponsorFamilyName', 'SponsorGivenName', 'WorkerFamilyName',
      'WorkerGivenName', 'FullName', 'full_name', 'first_name', 'last_name'],
  },
  dates: {
    label: 'Dates',
    color: '#0d9488',
    keys: ['DOB', 'DOBYear', 'DOBMonth', 'DOBDay', 'DateOfBirth', 'ApplicantDOB',
      'DateOfMarriage', 'date_of_birth'],
  },
  identity: {
    label: 'Identity & Citizenship',
    color: '#3b82f6',
    keys: ['Sex', 'MaritalStatus', 'Nationality', 'CountryOfBirth', 'CountryOfCitizenship',
      'WorkerNationality', 'PlaceOfBirth', 'PassportNo', 'PassportNumber',
      'nationality', 'passport_number', 'sex', 'marital_status', 'place_of_birth',
      'country_of_birth', 'country_of_residence', 'citizenship'],
  },
  contact: {
    label: 'Contact Information',
    color: '#10b981',
    keys: ['Email', 'Phone', 'MailingAddress', 'Address', 'email', 'phone', 'address',
      'telephone', 'mobile'],
  },
  employment: {
    label: 'Employment & Education',
    color: '#f59e0b',
    keys: ['Occupation', 'JobTitle', 'Employer', 'EmployerName', 'BusinessAddress',
      'DLI', 'FieldOfStudy', 'LMIANumber', 'occupation', 'employer_name', 'visa_type'],
  },
  other: {
    label: 'Other Information',
    color: '#8b5cf6',
    keys: ['UCI', 'uci_number'],
  },
};

function categorizeFields(fields) {
  const sections = [];
  const used = new Set();

  for (const [sectionKey, section] of Object.entries(FIELD_SECTIONS)) {
    const sectionFields = fields.filter(f => section.keys.includes(f.name) && !used.has(f.name));
    if (sectionFields.length > 0) {
      sectionFields.forEach(f => used.add(f.name));
      sections.push({ key: sectionKey, ...section, fields: sectionFields });
    }
  }

  // Remaining uncategorized
  const remaining = fields.filter(f => !used.has(f.name));
  if (remaining.length > 0) {
    sections.push({
      key: 'uncategorized',
      label: 'Additional Fields',
      color: '#6b7280',
      fields: remaining,
    });
  }

  return sections;
}

export default function PDFFormViewer({ formNumber, formName, onClose }) {
  const [fields, setFields] = useState([]);
  const [formType, setFormType] = useState('unknown');
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState(null);
  const [filledCount, setFilledCount] = useState(0);

  useEffect(() => {
    loadFields();
  }, [formNumber]);

  useEffect(() => {
    setFilledCount(Object.values(values).filter(v => v && String(v).trim()).length);
  }, [values]);

  const loadFields = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getIRCCTemplateFields(formNumber);
      setFields(data.fields || []);
      setFormType(data.form_type || 'unknown');
      // Initialize empty values
      const initial = {};
      (data.fields || []).forEach(f => { initial[f.name] = ''; });
      setValues(initial);
    } catch (err) {
      setError('Failed to load form fields: ' + err.message);
    }
    setLoading(false);
  };

  const handleChange = (fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleFillAndDownload = async () => {
    setFilling(true);
    try {
      const blob = await api.fillIRCCTemplate(formNumber, values);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formNumber} (Filled).pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to generate filled PDF: ' + err.message);
    }
    setFilling(false);
  };

  const handleReset = () => {
    const initial = {};
    fields.forEach(f => { initial[f.name] = ''; });
    setValues(initial);
  };

  const pdfUrl = api.viewIRCCTemplate(formNumber);
  const sections = categorizeFields(fields);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '95vw', maxWidth: 1400, height: '90vh',
        background: 'var(--bg-base)', borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,.3)',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-elevated)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(79,70,229,.1), rgba(139,92,246,.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#4f46e5',
            }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                {formNumber}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {formName} · {formType === 'acroform' ? 'Interactive Form' : 'XML-Based Form'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
              background: formType === 'acroform' ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)',
              color: formType === 'acroform' ? '#10b981' : '#f59e0b',
            }}>
              {formType === 'acroform' ? 'AcroForm' : 'XFA'}
            </span>
            <button className="modal-close" onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 10,
            }}><X size={18} /></button>
          </div>
        </div>

        {/* Body — Split View */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: PDF Preview */}
          <div style={{
            flex: '0 0 55%', borderRight: '1px solid var(--border-light)',
            display: 'flex', flexDirection: 'column', background: '#525659',
          }}>
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,.1)',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,0,0,.2)', flexShrink: 0,
            }}>
              <Eye size={14} color="#fff" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>PDF Preview</span>
            </div>
            <iframe
              src={pdfUrl}
              title={`${formNumber} PDF Preview`}
              style={{
                flex: 1, width: '100%', border: 'none',
              }}
            />
          </div>

          {/* Right: Form Fields Editor */}
          <div style={{
            flex: '0 0 45%', display: 'flex', flexDirection: 'column',
            background: 'var(--bg-base)',
          }}>
            {/* Editor Header */}
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid var(--border-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-elevated)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={14} color="var(--text-secondary)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Form Fields
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                  border: '1px solid var(--border-light)',
                }}>
                  {filledCount}/{fields.length} filled
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 8px' }}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>

            {/* XFA Warning Banner */}
            {formType === 'xfa' && (
              <div style={{
                margin: '12px 16px 0', padding: '10px 14px', borderRadius: 8,
                background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)',
                display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0,
              }}>
                <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                  This form uses <strong>XFA (XML-based)</strong> formatting. The PDF preview may not
                  render all fields correctly in the browser. Fill the fields below and click
                  <strong> Fill &amp; Download</strong> to generate a completed PDF.
                </div>
              </div>
            )}

            {/* Fields Scroll Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {loading ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', color: 'var(--text-muted)',
                }}>
                  <Loader size={24} className="spin" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 13 }}>Analyzing form fields...</div>
                </div>
              ) : error ? (
                <div style={{
                  padding: 20, textAlign: 'center', color: '#ef4444', fontSize: 13,
                }}>
                  <AlertTriangle size={24} style={{ marginBottom: 8 }} />
                  <div>{error}</div>
                </div>
              ) : fields.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', color: 'var(--text-muted)',
                }}>
                  <FileText size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No Fields Detected</div>
                  <div style={{ fontSize: 12 }}>This PDF does not have fillable form fields</div>
                </div>
              ) : (
                sections.map(section => (
                  <div key={section.key} style={{ marginBottom: 20 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                      paddingBottom: 6, borderBottom: `2px solid ${section.color}20`,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: section.color,
                      }} />
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: section.color,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {section.label}
                      </span>
                      <span style={{
                        fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
                      }}>
                        ({section.fields.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {section.fields.map(field => (
                        <div key={field.name}>
                          <label style={{
                            display: 'block', fontSize: 11, fontWeight: 600,
                            color: 'var(--text-secondary)', marginBottom: 4,
                          }}>
                            {field.label}
                            {field.clientField && (
                              <span style={{
                                fontSize: 9, color: 'var(--text-muted)',
                                marginLeft: 6, fontWeight: 400,
                              }}>
                                → {field.clientField}
                              </span>
                            )}
                          </label>

                          {field.type === 'checkbox' ? (
                            <label style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              fontSize: 12, cursor: 'pointer',
                            }}>
                              <input
                                type="checkbox"
                                checked={values[field.name] === 'true' || values[field.name] === true}
                                onChange={e => handleChange(field.name, e.target.checked ? 'true' : '')}
                                style={{ width: 16, height: 16 }}
                              />
                              <span style={{ color: 'var(--text-secondary)' }}>Checked</span>
                            </label>
                          ) : field.type === 'dropdown' && field.options ? (
                            <select
                              className="form-select"
                              value={values[field.name] || ''}
                              onChange={e => handleChange(field.name, e.target.value)}
                              style={{ fontSize: 12, padding: '6px 10px', height: 32 }}
                            >
                              <option value="">— Select —</option>
                              {field.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === 'signature' ? (
                            <div style={{
                              padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)',
                              background: 'var(--bg-elevated)', borderRadius: 6,
                              border: '1px dashed var(--border)',
                              fontStyle: 'italic',
                            }}>
                              Sign after printing
                            </div>
                          ) : (
                            <input
                              className="form-input"
                              type="text"
                              value={values[field.name] || ''}
                              onChange={e => handleChange(field.name, e.target.value)}
                              placeholder={field.label}
                              style={{ fontSize: 12, padding: '6px 10px', height: 32 }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Action Footer */}
            {fields.length > 0 && (
              <div style={{
                padding: '14px 20px', borderTop: '1px solid var(--border-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-elevated)', flexShrink: 0,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {filledCount > 0 ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={12} color="#10b981" />
                      {filledCount} of {fields.length} fields filled
                    </span>
                  ) : (
                    'Fill in fields to generate a completed PDF'
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleFillAndDownload}
                  disabled={filling || filledCount === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, padding: '8px 16px',
                  }}
                >
                  {filling ? (
                    <><Loader size={14} className="spin" /> Generating...</>
                  ) : (
                    <><Download size={14} /> Fill &amp; Download</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
