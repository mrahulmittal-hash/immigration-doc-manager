import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Building2, Plus, Link2, Unlink, ExternalLink, X, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  active: '#10b981',
  inactive: '#6b7280',
  terminated: '#ef4444',
};

export default function EmployerLink({ clientId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employers, setEmployers] = useState([]);
  const [form, setForm] = useState({ employer_id: '', job_title: '', start_date: '', wage: '', wage_type: 'hourly' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const fetchLinks = useCallback(async () => {
    try {
      const client = await api.getClient(clientId);
      setLinks(client.employer_links || []);
    } catch {
      setLinks([]);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const openModal = async () => {
    setShowModal(true);
    setForm({ employer_id: '', job_title: '', start_date: '', wage: '', wage_type: 'hourly' });
    try {
      const data = await api.getEmployers();
      setEmployers(data);
    } catch {
      setEmployers([]);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    if (!form.employer_id) return;
    setSubmitting(true);
    try {
      await api.linkClientToEmployer(form.employer_id, {
        client_id: clientId,
        job_title: form.job_title,
        start_date: form.start_date,
        wage: form.wage ? parseFloat(form.wage) : undefined,
        wage_type: form.wage_type,
      });
      setShowModal(false);
      fetchLinks();
    } catch (err) {
      console.error('Failed to link employer:', err);
    }
    setSubmitting(false);
  };

  const handleUnlink = async (empId) => {
    if (!confirm('Unlink this employer from the client?')) return;
    try {
      await api.unlinkClientFromEmployer(empId, clientId);
      fetchLinks();
    } catch (err) {
      console.error('Failed to unlink employer:', err);
    }
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Employers linked to this client for work permits and LMIA applications.
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={openModal}>
          <Plus size={14} /> Link Employer
        </button>
      </div>

      {links.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Building2 size={32} /></div>
            <div className="empty-title">No employers linked</div>
            <div className="empty-text">Link an employer to associate work permits, job offers, and LMIA records with this client.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {links.map(link => {
            const statusColor = STATUS_COLORS[link.status] || STATUS_COLORS.active;
            return (
              <div key={link.employer_id || link.id} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-surface)', border: '1px solid var(--border)', flexShrink: 0,
                    }}>
                      <Building2 size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {link.company_name || 'Unknown Employer'}
                        </span>
                        {link.status && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            padding: '2px 8px', borderRadius: 12,
                            color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33`,
                          }}>
                            {link.status}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {link.job_title && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Briefcase size={12} style={{ color: 'var(--text-muted)' }} />
                            {link.job_title}
                          </span>
                        )}
                        {link.wage && (
                          <span>
                            ${Number(link.wage).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                            {link.wage_type === 'hourly' ? '/hr' : '/yr'}
                          </span>
                        )}
                        {link.start_date && (
                          <span>Started: {new Date(link.start_date).toLocaleDateString('en-CA')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button className="btn btn-ghost btn-sm" title="View Employer"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => navigate(`/employers/${link.employer_id}`)}>
                      <ExternalLink size={13} />
                    </button>
                    <button className="btn btn-ghost btn-sm" title="Unlink"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444' }}
                      onClick={() => handleUnlink(link.employer_id)}>
                      <Unlink size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link Employer Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Link Employer</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleLink}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label className="form-label">Employer</label>
                  <select className="form-select" value={form.employer_id}
                    onChange={e => setForm(f => ({ ...f, employer_id: e.target.value }))} required>
                    <option value="">Select an employer...</option>
                    {employers.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.company_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Job Title</label>
                  <input className="form-input" placeholder="e.g. Software Developer"
                    value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-input"
                    value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Wage</label>
                  <input type="number" step="0.01" className="form-input" placeholder="25.00"
                    value={form.wage} onChange={e => setForm(f => ({ ...f, wage: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Wage Type</label>
                  <select className="form-select" value={form.wage_type}
                    onChange={e => setForm(f => ({ ...f, wage_type: e.target.value }))}>
                    <option value="hourly">Hourly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Linking...' : 'Link Employer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
