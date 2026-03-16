import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Megaphone, Plus, ExternalLink, CheckCircle, Clock, AlertTriangle, X, Globe } from 'lucide-react';

const EMPTY_AD_FORM = {
  job_bank_id: '',
  job_title: '',
  noc_code: '',
  posting_date: '',
  expiry_date: '',
  posting_url: '',
  notes: '',
};

const EMPTY_EFFORT_FORM = {
  platform: '',
  url: '',
  posting_date: '',
  expiry_date: '',
  notes: '',
};

function getDaysRemaining(expiryDate) {
  if (!expiryDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
}

function getDaysSincePosting(postingDate) {
  if (!postingDate) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const posted = new Date(postingDate);
  posted.setHours(0, 0, 0, 0);
  return Math.floor((now - posted) / (1000 * 60 * 60 * 24));
}

function getDaysRemainingColor(days) {
  if (days === null) return '#9ca3af';
  if (days <= 0) return '#ef4444';
  if (days <= 7) return '#f59e0b';
  return '#10b981';
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-CA');
}

export default function JobAdTracker({ lmiaId, ads, onRefresh }) {
  const [showAdForm, setShowAdForm] = useState(false);
  const [showEffortForm, setShowEffortForm] = useState(false);
  const [adForm, setAdForm] = useState({ ...EMPTY_AD_FORM });
  const [effortForm, setEffortForm] = useState({ ...EMPTY_EFFORT_FORM });
  const [submitting, setSubmitting] = useState(false);

  const jobAds = ads || [];
  const additionalAds = [];
  jobAds.forEach(ad => {
    if (ad.additional_ads && Array.isArray(ad.additional_ads)) {
      ad.additional_ads.forEach(extra => additionalAds.push({ ...extra, parentAdId: ad.id }));
    }
  });

  const handleAddAd = async (e) => {
    e.preventDefault();
    if (!adForm.job_title || !adForm.posting_date) return;
    setSubmitting(true);
    try {
      await api.createJobAd(lmiaId, adForm);
      setAdForm({ ...EMPTY_AD_FORM });
      setShowAdForm(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to create job ad:', err);
    }
    setSubmitting(false);
  };

  const handleAddEffort = async (e) => {
    e.preventDefault();
    if (!effortForm.platform) return;
    // Add effort to the first job ad's additional_ads
    const targetAd = jobAds[0];
    if (!targetAd) return;
    setSubmitting(true);
    try {
      const existing = targetAd.additional_ads || [];
      await api.updateJobAd(targetAd.id, {
        additional_ads: [...existing, { ...effortForm, added_at: new Date().toISOString() }],
      });
      setEffortForm({ ...EMPTY_EFFORT_FORM });
      setShowEffortForm(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to add recruitment effort:', err);
    }
    setSubmitting(false);
  };

  // Empty state
  if (jobAds.length === 0 && !showAdForm) {
    return (
      <div>
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Megaphone size={32} /></div>
            <div className="empty-title">No job ads tracked</div>
            <div className="empty-text">Add job bank postings and recruitment efforts to track the advertising period.</div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, margin: '16px auto 0' }}
              onClick={() => setShowAdForm(true)}
            >
              <Plus size={14} /> Add Job Ad
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => { setShowAdForm(s => !s); setShowEffortForm(false); }}
        >
          {showAdForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Job Ad</>}
        </button>
        {jobAds.length > 0 && (
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setShowEffortForm(s => !s); setShowAdForm(false); }}
          >
            {showEffortForm ? <><X size={14} /> Cancel</> : <><Globe size={14} /> Add Recruitment Effort</>}
          </button>
        )}
      </div>

      {/* Add Job Ad form */}
      {showAdForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--text-primary)' }}>
            New Job Ad
          </div>
          <form onSubmit={handleAddAd}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Job Bank ID</label>
                <input className="form-input" placeholder="e.g. 12345678"
                  value={adForm.job_bank_id} onChange={e => setAdForm(f => ({ ...f, job_bank_id: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input className="form-input" placeholder="e.g. Cook"
                  value={adForm.job_title} onChange={e => setAdForm(f => ({ ...f, job_title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">NOC Code</label>
                <input className="form-input" placeholder="e.g. 63200"
                  value={adForm.noc_code} onChange={e => setAdForm(f => ({ ...f, noc_code: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Posting Date</label>
                <input type="date" className="form-input"
                  value={adForm.posting_date} onChange={e => setAdForm(f => ({ ...f, posting_date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input type="date" className="form-input"
                  value={adForm.expiry_date} onChange={e => setAdForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Posting URL</label>
                <input className="form-input" placeholder="https://..."
                  value={adForm.posting_url} onChange={e => setAdForm(f => ({ ...f, posting_url: e.target.value }))} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-textarea" rows={2} placeholder="Additional details..."
                  value={adForm.notes} onChange={e => setAdForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={submitting}>
                <Plus size={14} /> {submitting ? 'Adding...' : 'Add Job Ad'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Recruitment Effort form */}
      {showEffortForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--text-primary)' }}>
            New Recruitment Effort
          </div>
          <form onSubmit={handleAddEffort}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Platform</label>
                <input className="form-input" placeholder="e.g. Indeed, LinkedIn, Kijiji"
                  value={effortForm.platform} onChange={e => setEffortForm(f => ({ ...f, platform: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">URL</label>
                <input className="form-input" placeholder="https://..."
                  value={effortForm.url} onChange={e => setEffortForm(f => ({ ...f, url: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Posting Date</label>
                <input type="date" className="form-input"
                  value={effortForm.posting_date} onChange={e => setEffortForm(f => ({ ...f, posting_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input type="date" className="form-input"
                  value={effortForm.expiry_date} onChange={e => setEffortForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-textarea" rows={2} placeholder="Details about this recruitment effort..."
                  value={effortForm.notes} onChange={e => setEffortForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={submitting}>
                <Plus size={14} /> {submitting ? 'Adding...' : 'Add Effort'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Job Ad cards */}
      {jobAds.map(ad => {
        const daysRemaining = getDaysRemaining(ad.expiry_date);
        const daysColor = getDaysRemainingColor(daysRemaining);
        const daysSincePosting = getDaysSincePosting(ad.posting_date);
        const minMet = daysSincePosting >= 28;
        const progressPercent = Math.min(100, Math.round((daysSincePosting / 28) * 100));

        return (
          <div key={ad.id} className="card" style={{ marginBottom: 16 }}>
            {/* Ad header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Megaphone size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    {ad.job_title || 'Job Ad'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginLeft: 23, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {ad.job_bank_id && <span>Job Bank ID: {ad.job_bank_id}</span>}
                    <span>Posted: {formatDate(ad.posting_date)}</span>
                    <span>Expires: {formatDate(ad.expiry_date)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {/* Days remaining badge */}
                  {daysRemaining !== null && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
                      background: `${daysColor}18`, color: daysColor, border: `1px solid ${daysColor}33`,
                    }}>
                      {daysRemaining <= 0 ? (
                        <><AlertTriangle size={11} /> Expired</>
                      ) : (
                        <><Clock size={11} /> {daysRemaining}d remaining</>
                      )}
                    </span>
                  )}
                  {ad.posting_url && (
                    <a href={ad.posting_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                      <ExternalLink size={11} /> View Posting
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* 4-week progress bar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  4-Week Minimum Advertising Period
                  {minMet && (
                    <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
                      <CheckCircle size={13} /> Met
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {daysSincePosting} / 28 days
                </span>
              </div>
              <div style={{
                width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progressPercent}%`, height: '100%', borderRadius: 4,
                  background: minMet ? '#10b981' : '#3b82f6',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Notes */}
            {ad.notes && (
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                {ad.notes}
              </div>
            )}

            {/* Additional recruitment efforts */}
            {ad.additional_ads && ad.additional_ads.length > 0 && (
              <div style={{ padding: '12px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Additional Recruitment Efforts
                </div>
                {ad.additional_ads.map((effort, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Globe size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{effort.platform}</span>
                      {effort.posting_date && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {formatDate(effort.posting_date)}
                          {effort.expiry_date && ` - ${formatDate(effort.expiry_date)}`}
                        </span>
                      )}
                    </div>
                    {effort.url && (
                      <a href={effort.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none', fontSize: 11 }}>
                        <ExternalLink size={10} /> Link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
