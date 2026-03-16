import { useState } from 'react';
import {
  UserPlus, MessageSquare, FileSignature, FolderOpen, FileCheck, Send,
  Search, CheckCircle, ChevronDown, ChevronUp, Circle, AlertCircle
} from 'lucide-react';

const STAGES = [
  {
    id: 'lead',
    label: 'New Lead',
    icon: UserPlus,
    description: 'Contact added, basic info captured',
    tasks: [
      { key: 'has_name', label: 'Client name recorded' },
      { key: 'has_email', label: 'Email address captured' },
      { key: 'has_phone', label: 'Phone number captured' },
      { key: 'has_nationality', label: 'Nationality recorded' },
    ],
  },
  {
    id: 'consultation',
    label: 'Consultation',
    icon: MessageSquare,
    description: 'Needs assessment, visa pathway determined',
    tasks: [
      { key: 'has_visa_type', label: 'Visa type selected' },
      { key: 'has_notes', label: 'Consultation notes added' },
      { key: 'pif_sent', label: 'PIF form sent to client' },
      { key: 'has_passport', label: 'Passport info recorded' },
    ],
  },
  {
    id: 'retainer',
    label: 'Retainer Signed',
    icon: FileSignature,
    description: 'Agreement signed, case initiated',
    tasks: [
      { key: 'pif_completed', label: 'PIF form completed' },
      { key: 'has_dob', label: 'Date of birth recorded' },
      { key: 'has_documents', label: 'Initial documents uploaded' },
      { key: 'checklist_started', label: 'Document checklist initiated' },
    ],
  },
  {
    id: 'in_progress',
    label: 'Documents & Prep',
    icon: FolderOpen,
    description: 'Collecting documents, preparing application',
    tasks: [
      { key: 'docs_extracted', label: 'Documents data extracted' },
      { key: 'has_client_data', label: 'Client data fields populated' },
      { key: 'forms_uploaded', label: 'Application forms uploaded' },
      { key: 'forms_filled', label: 'Forms auto-filled' },
    ],
  },
  {
    id: 'submitted',
    label: 'Submitted',
    icon: Send,
    description: 'Application submitted to IRCC',
    tasks: [
      { key: 'all_forms_filled', label: 'All forms completed' },
      { key: 'docs_verified', label: 'Documents verified' },
      { key: 'application_sent', label: 'Application package sent' },
      { key: 'confirmation_received', label: 'Submission confirmation received' },
    ],
  },
  {
    id: 'approved',
    label: 'Approved',
    icon: CheckCircle,
    description: 'Decision received, case completed',
    tasks: [
      { key: 'decision_received', label: 'IRCC decision received' },
      { key: 'client_notified', label: 'Client notified of outcome' },
      { key: 'file_archived', label: 'Case file archived' },
      { key: 'follow_up', label: 'Follow-up scheduled' },
    ],
  },
];

function evaluateTask(key, client) {
  switch (key) {
    case 'has_name': return !!(client.first_name && client.last_name);
    case 'has_email': return !!client.email;
    case 'has_phone': return !!client.phone;
    case 'has_nationality': return !!client.nationality;
    case 'has_visa_type': return !!client.visa_type;
    case 'has_notes': return !!client.notes;
    case 'pif_sent': return client.pif_status === 'sent' || client.pif_status === 'completed';
    case 'has_passport': return !!client.passport_number;
    case 'pif_completed': return client.pif_status === 'completed';
    case 'has_dob': return !!client.date_of_birth;
    case 'has_documents': return (client.documents?.length || client.doc_count || 0) > 0;
    case 'checklist_started': return (client.checklist_count || 0) > 0;
    case 'docs_extracted': return (client.documents || []).some(d => d.extracted_text);
    case 'has_client_data': return (client.client_data?.length || client.data_count || 0) > 0;
    case 'forms_uploaded': return (client.forms?.length || client.form_count || 0) > 0;
    case 'forms_filled': return (client.filled_forms?.length || client.filled_count || 0) > 0;
    case 'all_forms_filled':
      return (client.forms?.length || 0) > 0 && (client.filled_forms?.length || 0) >= (client.forms?.length || 1);
    case 'docs_verified': return false;
    case 'application_sent': return client.pipeline_stage === 'submitted' || client.pipeline_stage === 'approved';
    case 'confirmation_received': return false;
    case 'decision_received': return client.pipeline_stage === 'approved';
    case 'client_notified': return false;
    case 'file_archived': return client.status === 'inactive';
    case 'follow_up': return false;
    default: return false;
  }
}

function getStageStatus(stage, client) {
  const completedTasks = stage.tasks.filter(t => evaluateTask(t.key, client)).length;
  const total = stage.tasks.length;
  if (completedTasks === total) return 'completed';
  if (completedTasks > 0) return 'in-progress';
  return 'pending';
}

const STATUS_STYLES = {
  completed: {
    circle: { background: '#10b981', color: '#fff' },
    connector: { background: '#10b981' },
    badge: { background: '#dcfce7', color: '#059669', border: '1px solid #bbf7d0' },
    badgeText: 'COMPLETE',
  },
  'in-progress': {
    circle: { background: '#fff7ed', border: '2px solid #f97316', color: '#f97316' },
    connector: { background: '#fed7aa' },
    badge: { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
    badgeText: 'IN PROGRESS',
  },
  pending: {
    circle: { background: '#f9fafb', border: '2px solid #d1d5db', color: '#9ca3af' },
    connector: { background: '#e5e7eb' },
    badge: null,
    badgeText: null,
  },
};

export default function CaseLifecycle({ client }) {
  const [expandedStage, setExpandedStage] = useState(null);

  const stageStatuses = STAGES.map(stage => ({
    ...stage,
    status: getStageStatus(stage, client),
    completedCount: stage.tasks.filter(t => evaluateTask(t.key, client)).length,
  }));

  const totalCompleted = stageStatuses.filter(s => s.status === 'completed').length;
  const progressPct = (totalCompleted / STAGES.length) * 100;

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
          Immigration Case Lifecycle
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          {totalCompleted}/{STAGES.length} steps complete
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, transition: 'width 0.5s ease',
          width: `${progressPct}%`,
          background: 'linear-gradient(90deg, #10b981, #059669)',
        }} />
      </div>

      {/* Steps */}
      {stageStatuses.map((stage, i) => {
        const styles = STATUS_STYLES[stage.status];
        const Icon = stage.icon;
        const isExpanded = expandedStage === stage.id;
        const isLast = i === STAGES.length - 1;

        return (
          <div key={stage.id}>
            {/* Step Row */}
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, cursor: 'pointer',
                padding: '8px 4px',
              }}
              onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
            >
              {/* Circle + Connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  ...styles.circle,
                  transition: 'all 0.2s',
                }}>
                  {stage.status === 'completed' ? (
                    <CheckCircle size={20} />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
                {!isLast && (
                  <div style={{
                    width: 2, height: isExpanded ? 'auto' : 24, minHeight: 24,
                    ...styles.connector,
                    transition: 'all 0.2s',
                  }} />
                )}
              </div>

              {/* Label */}
              <div style={{ flex: 1, paddingTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: stage.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {stage.label}
                  </span>
                  {styles.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 12,
                      letterSpacing: '0.05em', ...styles.badge,
                    }}>
                      {styles.badgeText}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {stage.description}
                </div>
              </div>

              {/* Count + Chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {stage.completedCount}/{stage.tasks.length}
                </span>
                {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>
            </div>

            {/* Expanded Tasks */}
            {isExpanded && (
              <div style={{
                marginLeft: 56, padding: '12px 16px', marginBottom: 8,
                background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-light)',
              }}>
                {stage.tasks.map(task => {
                  const done = evaluateTask(task.key, client);
                  return (
                    <div key={task.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                      borderBottom: '1px solid var(--border-light)',
                    }}>
                      {done ? (
                        <CheckCircle size={16} color="#10b981" />
                      ) : (
                        <Circle size={16} color="#d1d5db" />
                      )}
                      <span style={{
                        fontSize: 13, color: done ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontWeight: done ? 500 : 400,
                      }}>
                        {task.label}
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
