import { useState, useEffect } from 'react';
import { api } from '../api';
import { FileText, Download, Zap, CheckCircle, AlertCircle, ExternalLink, Loader, Pencil, Shield, AlertTriangle } from 'lucide-react';
import FormEditor from './FormEditor';

const CATEGORY_COLORS = {
  primary: { bg: 'rgba(59,130,246,.1)', color: '#3b82f6', border: 'rgba(59,130,246,.2)' },
  declaration: { bg: 'rgba(139,92,246,.1)', color: '#8b5cf6', border: 'rgba(139,92,246,.2)' },
  family: { bg: 'rgba(236,72,153,.1)', color: '#ec4899', border: 'rgba(236,72,153,.2)' },
  travel: { bg: 'rgba(20,184,166,.1)', color: '#14b8a6', border: 'rgba(20,184,166,.2)' },
  sponsorship: { bg: 'rgba(245,158,11,.1)', color: '#f59e0b', border: 'rgba(245,158,11,.2)' },
  relationship: { bg: 'rgba(244,63,94,.1)', color: '#f43f5e', border: 'rgba(244,63,94,.2)' },
  refugee: { bg: 'rgba(168,85,247,.1)', color: '#a855f7', border: 'rgba(168,85,247,.2)' },
};

export default function IRCCFormGenerator({ clientId }) {
  const [formsData, setFormsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);
  const [editingFormId, setEditingFormId] = useState(null);
  const [verificationBlock, setVerificationBlock] = useState(null);
  const [verificationSummary, setVerificationSummary] = useState(null);

  const fetchForms = () => {
    api.getClientIRCCForms(clientId)
      .then(setFormsData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchForms(); }, [clientId]);

  useEffect(() => {
    api.getPIFVerificationSummary(clientId)
      .then(setVerificationSummary)
      .catch(() => {});
  }, [clientId]);

  const handleGenerate = async (formNumber) => {
    setGenerating(formNumber);
    setVerificationBlock(null);
    try {
      const result = await api.generateIRCCForm(clientId, formNumber);
      if (result.error === 'verification_required') {
        setVerificationBlock(result);
      } else {
        setResults(prev => ({ ...prev, [formNumber]: result }));
        fetchForms();
      }
    } catch (err) {
      if (err.data?.error === 'verification_required') {
        setVerificationBlock(err.data);
      } else {
        setResults(prev => ({ ...prev, [formNumber]: { error: err.message } }));
      }
    }
    setGenerating(null);
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    setVerificationBlock(null);
    try {
      const result = await api.generateAllIRCCForms(clientId);
      const newResults = {};
      for (const r of result.results) {
        newResults[r.form_number] = r;
      }
      setResults(newResults);
      fetchForms();
    } catch (err) {
      if (err.data?.error === 'verification_required') {
        setVerificationBlock(err.data);
      } else {
        setError(err.message);
      }
    }
    setGeneratingAll(false);
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;
  if (error && !formsData) return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon"><AlertCircle size={32} /></div>
        <div className="empty-title">Error loading forms</div>
        <div className="empty-text">{error}</div>
      </div>
    </div>
  );

  const filledCount = formsData?.forms?.filter(f => f.already_filled || results[f.form_number]?.download_url).length || 0;
  const totalCount = formsData?.forms?.length || 0;

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              IRCC Forms for {formsData?.visa_type}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {totalCount} required forms — {filledCount} generated
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleGenerateAll} disabled={generatingAll}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {generatingAll ? <Loader size={14} className="spin" /> : <Zap size={14} />}
            {generatingAll ? 'Generating All...' : 'Generate All Forms'}
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 16 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{
              width: `${totalCount ? (filledCount / totalCount * 100) : 0}%`,
              background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
            {filledCount}/{totalCount} forms ready
          </div>
        </div>
      </div>

      {/* Verification Status Banner */}
      {verificationSummary && verificationSummary.total > 0 && (
        <div className="card" style={{
          marginBottom: 16, padding: '14px 20px',
          background: verificationSummary.unverified > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
          border: `1px solid ${verificationSummary.unverified > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {verificationSummary.unverified > 0 ? (
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
            ) : (
              <Shield size={16} style={{ color: '#10b981' }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {verificationSummary.unverified > 0
                  ? `${verificationSummary.unverified} unverified PIF field(s) — form generation blocked`
                  : 'All PIF fields verified — ready to generate forms'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {verificationSummary.verified}/{verificationSummary.total} verified
                {verificationSummary.flagged > 0 && ` · ${verificationSummary.flagged} flagged`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Block Warning */}
      {verificationBlock && (
        <div className="card" style={{
          marginBottom: 16, padding: '16px 20px',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
                Verification Required
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {verificationBlock.message}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {verificationBlock.unverified_fields?.slice(0, 10).map(f => (
                  <span key={f} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontWeight: 600,
                  }}>
                    {f}
                  </span>
                ))}
                {verificationBlock.unverified_fields?.length > 10 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px' }}>
                    +{verificationBlock.unverified_fields.length - 10} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {formsData?.forms?.map(form => {
          const cat = CATEGORY_COLORS[form.category] || CATEGORY_COLORS.primary;
          const result = results[form.form_number];
          const isGenerating = generating === form.form_number;
          const isCompleted = form.already_filled || result?.download_url;
          const filledFormId = result?.id || form.filled_form_id;
          const downloadUrl = result?.download_url || form.download_url;

          return (
            <div key={form.form_number} className="card" style={{
              padding: '18px 22px',
              borderLeft: `3px solid ${cat.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 800, color: cat.color,
                      background: cat.bg, padding: '3px 10px', borderRadius: 6,
                      border: `1px solid ${cat.border}`,
                    }}>
                      {form.form_number}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                      background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 12,
                      textTransform: 'uppercase',
                    }}>
                      {form.category}
                    </span>
                    {isCompleted && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                        <CheckCircle size={12} /> Generated
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {form.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {form.field_count} mappable fields
                  </div>
                  {result?.error && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>
                      Error: {result.error}
                    </div>
                  )}
                  {result?.note && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>
                      {result.note}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {form.url && (
                    <a href={form.url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={12} /> Template
                    </a>
                  )}
                  {isCompleted && filledFormId && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingFormId(filledFormId)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Pencil size={12} /> Edit
                    </button>
                  )}
                  {downloadUrl ? (
                    <a href={downloadUrl} className="btn btn-success btn-sm" download
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Download size={12} /> Download
                    </a>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => handleGenerate(form.form_number)}
                      disabled={isGenerating || generatingAll}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isGenerating ? <Loader size={12} className="spin" /> : <Zap size={12} />}
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Editor Modal */}
      {editingFormId && (
        <FormEditor
          filledFormId={editingFormId}
          clientId={clientId}
          onClose={() => setEditingFormId(null)}
          onSaved={() => { fetchForms(); setEditingFormId(null); }}
        />
      )}
    </div>
  );
}
