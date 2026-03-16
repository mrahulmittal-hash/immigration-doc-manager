import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Pencil, User, Mail, Phone, Globe, FileText, ClipboardList, Send, Stamp, Shield } from 'lucide-react';

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
      { key: 'retainer', label: 'Retainer agreement signed', check: c => {
        const stage = c.pipeline_stage || 'lead';
        const stageOrder = ['lead', 'consultation', 'retainer_signed', 'in_progress', 'submitted', 'approved'];
        return stageOrder.indexOf(stage) >= 2;
      }},
      { key: 'active', label: 'Account set to active', check: c => c.status === 'active' },
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
  },
];

export default function WorkflowStages({ client }) {
  const [editingStage, setEditingStage] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {WORKFLOW_STAGES.map((stage, stageIdx) => {
        const completed = stage.items.filter(item => item.check(client)).length;
        const total = stage.items.length;
        const isComplete = completed === total;
        const isInProgress = completed > 0 && !isComplete;
        const isExpanded = editingStage === stage.id;
        const StageIcon = stage.icon;

        const statusLabel = isComplete ? 'COMPLETE' : isInProgress ? 'IN PROGRESS' : null;
        const statusColor = isComplete ? '#10b981' : '#f59e0b';

        return (
          <div key={stage.id} style={{ position: 'relative' }}>
            {/* Vertical connector line */}
            {stageIdx < WORKFLOW_STAGES.length - 1 && (
              <div style={{
                position: 'absolute', left: 19, top: 40, bottom: -1, width: 2,
                background: isComplete ? '#10b981' : 'var(--border)',
                zIndex: 0,
              }} />
            )}

            {/* Stage header */}
            <div
              onClick={() => setEditingStage(prev => prev === stage.id ? null : stage.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                cursor: 'pointer', position: 'relative', zIndex: 1,
              }}
            >
              {/* Stage icon circle */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isComplete ? '#10b981' : isInProgress ? `${stage.color}18` : 'var(--bg-elevated)',
                border: `2px solid ${isComplete ? '#10b981' : isInProgress ? stage.color : 'var(--border)'}`,
                color: isComplete ? '#fff' : isInProgress ? stage.color : 'var(--text-muted)',
              }}>
                {isComplete ? <CheckCircle2 size={20} /> : <StageIcon size={18} />}
              </div>

              {/* Stage label & description */}
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

              {/* Progress count & expand toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {completed}/{total}
                </span>
                {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>
            </div>

            {/* Expanded checklist items — only visible when clicked */}
            {isExpanded && (
              <div style={{
                marginLeft: 52, marginBottom: 8, padding: '12px 16px',
                background: 'var(--bg-base)', borderRadius: 10,
                border: '1px solid var(--border-light)',
              }}>
                {stage.items.map(item => {
                  const checked = item.check(client);
                  return (
                    <div key={item.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border-light)',
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
