import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, User, ClipboardList, FileText, Send, Stamp, Shield, Save } from 'lucide-react';
import { api } from '../api';

const WORKFLOW_STAGES = [
  {
    id: 'new_lead',
    label: 'New Lead',
    icon: User,
    color: '#10b981',
    description: 'Contact added, basic info captured',
    items: [
      { key: 'name', label: 'Client name recorded', check: c => !!(c.first_name && c.last_name) },
      { key: 'email', label: 'Email address captured', check: c => !!c.email },
      { key: 'phone', label: 'Phone number captured', check: c => !!c.phone },
      { key: 'nationality', label: 'Nationality recorded', check: c => !!c.nationality },
    ],
    fields: [
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'nationality', label: 'Nationality', type: 'text' },
    ],
  },
  {
    id: 'consultation',
    label: 'Consultation',
    icon: ClipboardList,
    color: '#f59e0b',
    description: 'Needs assessment, visa pathway determined',
    items: [
      { key: 'visa_type', label: 'Visa type selected', check: c => !!c.visa_type },
      { key: 'passport', label: 'Passport number recorded', check: c => !!c.passport_number },
      { key: 'dob', label: 'Date of birth recorded', check: c => !!c.date_of_birth },
      { key: 'notes', label: 'Case notes added', check: c => !!c.notes },
    ],
    fields: [
      { key: 'visa_type', label: 'Visa Type', type: 'select', options: '__serviceTypes__' },
      { key: 'passport_number', label: 'Passport Number', type: 'text' },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'notes', label: 'Case Notes', type: 'textarea' },
    ],
  },
  {
    id: 'retainer_signed',
    label: 'Retainer Signed',
    icon: Shield,
    color: '#8b5cf6',
    description: 'Agreement signed, case initiated',
    items: [
      { key: 'pif_sent', label: 'PIF form sent to client', check: c => c.pif_status === 'sent' || c.pif_status === 'completed' },
      { key: 'pif_completed', label: 'PIF form completed', check: c => c.pif_status === 'completed' },
      { key: 'agreement_generated', label: 'Retainer agreement generated', check: c => (c.retainer_agreements?.length || 0) > 0 },
      { key: 'agreement_sent', label: 'Agreement sent for signing', check: c => c.retainer_agreements?.some(a => ['sent', 'signed'].includes(a.status)) || false },
      { key: 'retainer', label: 'Retainer agreement signed', check: c => {
        if (c.retainer_agreements?.some(a => a.status === 'signed')) return true;
        const stage = c.pipeline_stage || 'lead';
        const stageOrder = ['lead', 'consultation', 'retainer_signed', 'in_progress', 'submitted', 'approved'];
        return stageOrder.indexOf(stage) >= 2;
      }},
      { key: 'active', label: 'Account set to active', check: c => c.status === 'active' },
    ],
    fields: [
      { key: 'pif_status', label: 'PIF Status', type: 'select', options: ['pending', 'sent', 'completed'] },
      { key: 'status', label: 'Account Status', type: 'select', options: ['active', 'inactive'] },
      { key: 'pipeline_stage', label: 'Pipeline Stage', type: 'select', options: ['lead', 'consultation', 'retainer_signed', 'in_progress', 'submitted', 'approved'] },
    ],
  },
  {
    id: 'documents_prep',
    label: 'Documents & Prep',
    icon: FileText,
    color: '#3b82f6',
    description: 'Collecting documents, preparing application',
    items: [
      { key: 'docs_uploaded', label: 'Documents uploaded', check: c => (c.documents?.length || 0) > 0 },
      { key: 'data_extracted', label: 'Data extracted from documents', check: c => (c.client_data?.length || 0) > 0 },
      { key: 'forms_uploaded', label: 'Application forms uploaded', check: c => (c.forms?.length || 0) > 0 },
      { key: 'forms_filled', label: 'Forms auto-filled', check: c => (c.filled_forms?.length || 0) > 0 },
    ],
    fields: [],
  },
  {
    id: 'submitted',
    label: 'Submitted',
    icon: Send,
    color: '#ec4899',
    description: 'Application submitted to IRCC',
    items: [
      { key: 'submitted', label: 'Application submitted', check: c => {
        const stage = c.pipeline_stage || 'lead';
        return stage === 'submitted' || stage === 'approved';
      }},
    ],
    fields: [
      { key: 'submission_date', label: 'Submission Date', type: 'date' },
      { key: 'ircc_reference', label: 'IRCC Reference #', type: 'text' },
    ],
  },
  {
    id: 'approved',
    label: 'Approved',
    icon: Stamp,
    color: '#059669',
    description: 'Application approved',
    items: [
      { key: 'approved', label: 'Application approved', check: c => (c.pipeline_stage || 'lead') === 'approved' },
    ],
    fields: [
      { key: 'approval_date', label: 'Approval Date', type: 'date' },
      { key: 'outcome', label: 'Outcome Notes', type: 'text' },
    ],
  },
];

export default function WorkflowStages({ client, editMode = false, onSave }) {
  const [expandedStage, setExpandedStage] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [serviceTypes, setServiceTypes] = useState([]);

  useEffect(() => {
    api.getActiveServiceFees().then(fees => setServiceTypes(fees.map(f => f.service_name))).catch(() => {});
  }, []);

  const totalItems = WORKFLOW_STAGES.reduce((sum, s) => sum + s.items.length, 0);
  const completedItems = WORKFLOW_STAGES.reduce((sum, s) => sum + s.items.filter(i => i.check(client)).length, 0);
  const completedStages = WORKFLOW_STAGES.filter(s => s.items.every(i => i.check(client))).length;
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const handleExpand = (stageId) => {
    if (expandedStage === stageId) {
      setExpandedStage(null);
      setEditData({});
    } else {
      setExpandedStage(stageId);
      const stage = WORKFLOW_STAGES.find(s => s.id === stageId);
      const initial = {};
      (stage?.fields || []).forEach(f => {
        initial[f.key] = client[f.key] || '';
      });
      setEditData(initial);
    }
  };

  const handleFieldChange = (key, value) => {
    setEditData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try { await onSave(editData); }
    catch (e) { console.error('Save failed:', e); }
    setSaving(false);
  };

  return (
    <div>
      {/* Progress Bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Case Progress
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
            {completedStages}/6 stages · {progressPct}%
          </span>
        </div>
        <div className="workflow-progress-bar">
          <div className="workflow-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Stages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {WORKFLOW_STAGES.map((stage, stageIdx) => {
          const completed = stage.items.filter(item => item.check(client)).length;
          const total = stage.items.length;
          const isComplete = completed === total;
          const isInProgress = completed > 0 && !isComplete;
          const isExpanded = expandedStage === stage.id;
          const StageIcon = stage.icon;
          const hasFields = stage.fields && stage.fields.length > 0;

          const statusLabel = isComplete ? 'COMPLETE' : isInProgress ? 'IN PROGRESS' : null;
          const statusColor = isComplete ? '#10b981' : '#f59e0b';

          return (
            <div key={stage.id} style={{ position: 'relative' }}>
              {stageIdx < WORKFLOW_STAGES.length - 1 && (
                <div style={{
                  position: 'absolute', left: 19, top: 40, bottom: -1, width: 2,
                  background: isComplete ? '#10b981' : 'var(--border)',
                  zIndex: 0,
                }} />
              )}

              <div
                onClick={() => handleExpand(stage.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                  cursor: 'pointer', position: 'relative', zIndex: 1,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isComplete ? '#10b981' : isInProgress ? `${stage.color}18` : 'var(--bg-elevated)',
                  border: `2px solid ${isComplete ? '#10b981' : isInProgress ? stage.color : 'var(--border)'}`,
                  color: isComplete ? '#fff' : isInProgress ? stage.color : 'var(--text-muted)',
                }}>
                  {isComplete ? <CheckCircle2 size={20} /> : <StageIcon size={18} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 700,
                      color: isComplete || isInProgress ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}>
                      {stage.label}
                    </span>
                    {statusLabel && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
                        padding: '2px 8px', borderRadius: 4,
                        background: `${statusColor}18`, color: statusColor,
                        border: `1px solid ${statusColor}33`,
                      }}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {stage.description}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {completed}/{total}
                  </span>
                  {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>
              </div>

              {isExpanded && (
                <div style={{
                  marginLeft: 52, marginBottom: 8, padding: '16px 20px',
                  background: 'var(--bg-base)', borderRadius: 10,
                  border: '1px solid var(--border-light)',
                }}>
                  {stage.items.map(item => {
                    const checked = item.check(client);
                    return (
                      <div key={item.key} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 0', borderBottom: '1px solid var(--border-light)',
                      }}>
                        {checked ? (
                          <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                        ) : (
                          <Circle size={18} style={{ color: 'var(--border)', flexShrink: 0 }} />
                        )}
                        <span style={{
                          fontSize: 13, fontWeight: 500,
                          color: checked ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}

                  {hasFields && (
                    <div className="workflow-stage-fields">
                      <div style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                        color: 'var(--text-muted)', textTransform: 'uppercase',
                        marginTop: 16, marginBottom: 10,
                        paddingTop: 12, borderTop: '1px solid var(--border-light)',
                      }}>
                        Edit Data
                      </div>
                      {stage.fields.map(field => (
                        <div key={field.key} className="workflow-field-row">
                          <label style={{
                            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                            minWidth: 120, flexShrink: 0,
                          }}>
                            {field.label}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              className="form-textarea"
                              value={editData[field.key] || ''}
                              onChange={e => handleFieldChange(field.key, e.target.value)}
                              rows={2}
                              style={{ fontSize: 13, flex: 1 }}
                            />
                          ) : field.type === 'select' ? (
                            <select
                              className="form-select"
                              value={editData[field.key] || ''}
                              onChange={e => handleFieldChange(field.key, e.target.value)}
                              style={{ fontSize: 13, flex: 1 }}
                            >
                              <option value="">— Select —</option>
                              {(field.options === '__serviceTypes__' ? serviceTypes : field.options).map(opt => (
                                <option key={opt} value={opt}>{opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type || 'text'}
                              className="form-input"
                              value={editData[field.key] || ''}
                              onChange={e => handleFieldChange(field.key, e.target.value)}
                              style={{ fontSize: 13, flex: 1 }}
                            />
                          )}
                        </div>
                      ))}
                      {onSave && (
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={handleSave}
                            disabled={saving}
                          >
                            <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {stage.id === 'documents_prep' && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Progress
                      </div>
                      {[
                        { label: 'Documents', val: client.documents?.length || 0 },
                        { label: 'Forms uploaded', val: client.forms?.length || 0 },
                        { label: 'Data fields', val: client.client_data?.length || 0 },
                        { label: 'Forms filled', val: client.filled_forms?.length || 0 },
                      ].map(s => (
                        <div key={s.label} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '5px 0', fontSize: 13, color: 'var(--text-secondary)',
                        }}>
                          <span>{s.label}</span>
                          <strong style={{ color: s.val > 0 ? '#10b981' : 'var(--text-muted)' }}>{s.val}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
