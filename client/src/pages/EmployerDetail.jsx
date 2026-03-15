import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Building2, Mail, Phone, Pencil, X, Save, Plus, Users, FileSearch, DollarSign, MapPin, Briefcase, Calendar, CheckCircle, Clock, Link2, Unlink } from 'lucide-react';

const PROVINCES = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'
];

const LMIA_STREAMS = [
  'High-wage', 'Low-wage', 'Global Talent Stream', 'Agricultural Stream',
  'Seasonal Agricultural Worker Program', 'Permanent Residence',
  'Caregiver', 'Francophone Mobility', 'Other'
];

const TEER_CATEGORIES = ['TEER 0','TEER 1','TEER 2','TEER 3','TEER 4','TEER 5'];

const TABS = [
  { id: 'overview',  label: 'Overview',  Icon: Building2 },
  { id: 'workers',   label: 'Workers',   Icon: Users },
  { id: 'lmias',     label: 'LMIAs',     Icon: FileSearch },
  { id: 'fees',      label: 'Fees',      Icon: DollarSign },
];

const LMIA_STATUS_BADGE = {
  draft: 'badge-gray', submitted: 'badge-primary', approved: 'badge-success',
  refused: 'badge-danger', withdrawn: 'badge-warning', expired: 'badge-gray',
};

const FEE_STATUS_BADGE = {
  unpaid: 'badge-warning', paid: 'badge-success', overdue: 'badge-danger', waived: 'badge-gray',
};

export default function EmployerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employer, setEmployer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Workers state
  const [clients, setClients] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ client_id: '', job_title: '', start_date: '', wage: '', wage_type: 'hourly' });

  // LMIAs state
  const [lmias, setLmias] = useState([]);
  const [showLmiaModal, setShowLmiaModal] = useState(false);
  const [lmiaForm, setLmiaForm] = useState({ job_title: '', noc_code: '', teer_category: '', wage_offered: '', wage_type: 'hourly', work_location: '', num_positions: 1, stream: '', client_id: '' });

  // Fees state
  const [fees, setFees] = useState([]);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({ description: '', amount: '', due_date: '', lmia_id: '' });

  const fetchEmployer = useCallback(async () => {
    try {
      const data = await api.getEmployer(id);
      setEmployer(data);
      setClients(data.clients || []);
      setLmias(data.lmias || []);
      setFees(data.fees || []);
      setEditForm({
        company_name: data.company_name || '', trade_name: data.trade_name || '',
        business_number: data.business_number || '', contact_name: data.contact_name || '',
        contact_email: data.contact_email || '', contact_phone: data.contact_phone || '',
        address: data.address || '', city: data.city || '', province: data.province || '',
        postal_code: data.postal_code || '', industry: data.industry || '',
        num_employees: data.num_employees || '', notes: data.notes || '', status: data.status || 'active',
      });
    } catch { /* handled by empty state */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchEmployer(); }, [fetchEmployer]);

  // Lazy-load all clients for link modal
  useEffect(() => {
    if (showLinkModal && allClients.length === 0) {
      api.getClients().then(setAllClients).catch(() => {});
    }
  }, [showLinkModal]);

  /* ── Handlers ──────────────────────────────────────────── */
  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.updateEmployer(id, editForm);
      setEditing(false);
      fetchEmployer();
    } catch (e) { alert(e.message || 'Save failed'); }
    setSaving(false);
  };

  const handleLinkWorker = async () => {
    setSaving(true);
    try {
      await api.linkClientToEmployer(id, linkForm);
      setShowLinkModal(false);
      setLinkForm({ client_id: '', job_title: '', start_date: '', wage: '', wage_type: 'hourly' });
      fetchEmployer();
    } catch (e) { alert(e.message || 'Failed to link worker'); }
    setSaving(false);
  };

  const handleUnlink = async (clientId) => {
    if (!confirm('Unlink this worker from the employer?')) return;
    await api.unlinkClientFromEmployer(id, clientId);
    fetchEmployer();
  };

  const handleCreateLmia = async () => {
    setSaving(true);
    try {
      const data = { ...lmiaForm, employer_id: parseInt(id) };
      if (!data.client_id) delete data.client_id;
      await api.createLMIA(data);
      setShowLmiaModal(false);
      setLmiaForm({ job_title: '', noc_code: '', teer_category: '', wage_offered: '', wage_type: 'hourly', work_location: '', num_positions: 1, stream: '', client_id: '' });
      fetchEmployer();
    } catch (e) { alert(e.message || 'Failed to create LMIA'); }
    setSaving(false);
  };

  const handleCreateFee = async () => {
    setSaving(true);
    try {
      const data = { ...feeForm };
      if (!data.lmia_id) delete data.lmia_id;
      await api.createEmployerFee(id, data);
      setShowFeeModal(false);
      setFeeForm({ description: '', amount: '', due_date: '', lmia_id: '' });
      fetchEmployer();
    } catch (e) { alert(e.message || 'Failed to create fee'); }
    setSaving(false);
  };

  const handleMarkPaid = async (feeId) => {
    try {
      await api.updateEmployerFee(feeId, { status: 'paid', paid_date: new Date().toISOString().split('T')[0] });
      fetchEmployer();
    } catch (e) { alert(e.message || 'Failed to mark paid'); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div className="spinner" />
    </div>
  );
  if (!employer) return <div className="empty">Employer not found.</div>;

  const activeLmiaCount = lmias.filter(l => l.status === 'approved' || l.status === 'submitted').length;
  const totalBilled = fees.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
  const outstanding = fees.filter(f => f.status !== 'paid' && f.status !== 'waived').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

  return (
    <div className="page-enter cd-wrap">

      {/* ── Hero Header ────────────────────────────────────── */}
      <div className="cd-hero">
        <div className="cd-hero-left">
          <div className="cd-avatar" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2))', color: '#3b82f6', border: '2px solid rgba(59,130,246,0.3)' }}>
            <Building2 size={24} />
          </div>
          <div className="cd-hero-info">
            <div className="cd-hero-name">{employer.company_name}</div>
            {employer.trade_name && <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>d/b/a {employer.trade_name}</div>}
            <div className="cd-hero-meta">
              {employer.industry && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Briefcase size={14} /> {employer.industry}</span>}
              {employer.contact_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {employer.contact_name}</span>}
              {employer.contact_email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={14} /> {employer.contact_email}</span>}
              {employer.contact_phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={14} /> {employer.contact_phone}</span>}
              {(employer.city || employer.province) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {[employer.address, employer.city, employer.province, employer.postal_code].filter(Boolean).join(', ')}</span>}
            </div>
            <div className="cd-hero-badges">
              {employer.industry && <span className="badge badge-primary">{employer.industry}</span>}
              <span className={`badge ${employer.status === 'active' ? 'badge-success' : 'badge-gray'}`}>{employer.status || 'active'}</span>
            </div>
          </div>
        </div>

        <div className="cd-hero-actions">
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setEditing(e => !e)}>
            {editing ? <><X size={14} /> Cancel</> : <><Pencil size={14} /> Edit</>}
          </button>
        </div>
      </div>

      {/* ── Stat Strip ─────────────────────────────────────── */}
      <div className="cd-stats">
        {[
          { Icon: Users, val: clients.length, label: 'Workers' },
          { Icon: FileSearch, val: activeLmiaCount, label: 'Active LMIAs' },
          { Icon: DollarSign, val: `$${totalBilled.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`, label: 'Total Billed' },
          { Icon: DollarSign, val: `$${outstanding.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`, label: 'Outstanding' },
        ].map(s => (
          <div key={s.label} className="cd-stat-chip">
            <span className="cd-stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.Icon size={18} /></span>
            <div>
              <div className="cd-stat-val">{s.val}</div>
              <div className="cd-stat-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="cd-tabs">
        {TABS.map(t => {
          const count = t.id === 'workers' ? clients.length : t.id === 'lmias' ? lmias.length : t.id === 'fees' ? fees.length : null;
          return (
            <button key={t.id}
              className={`cd-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              <t.Icon size={14} /> {t.label}
              {count !== null && <span className="cd-tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Overview Tab ──────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="card cd-edit-panel">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={14} /> Company Information</div>
            {!editing && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Pencil size={12} /> Edit</button>}
          </div>
          <div className="form-grid">
            {Object.entries(editForm).filter(([k]) => k !== 'status').map(([k, v]) => (
              <div key={k} className={`form-group ${k === 'notes' || k === 'address' ? 'form-full' : ''}`}>
                <label className="form-label">{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                {k === 'notes' ? (
                  <textarea className="form-textarea" value={v} rows={3} disabled={!editing}
                    onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
                ) : k === 'province' ? (
                  <select className="form-select" value={v} disabled={!editing}
                    onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))}>
                    <option value="">Select Province</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : k === 'num_employees' ? (
                  <input type="number" className="form-input" value={v} disabled={!editing}
                    onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
                ) : (
                  <input type="text" className="form-input" value={v} disabled={!editing}
                    onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          {editing && (
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleSaveEdit} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Workers Tab ───────────────────────────────────── */}
      {activeTab === 'workers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowLinkModal(true)}>
              <Link2 size={14} /> Link Worker
            </button>
          </div>

          {clients.length === 0 ? (
            <div className="card"><div className="empty">
              <div className="empty-icon"><Users size={32} /></div>
              <div className="empty-title">No workers linked</div>
              <div className="empty-text">Link existing clients as workers for this employer.</div>
            </div></div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ padding: '16px 20px' }}>Name</th>
                      <th style={{ padding: '16px 20px' }}>Job Title</th>
                      <th style={{ padding: '16px 20px' }}>Wage</th>
                      <th style={{ padding: '16px 20px' }}>Start Date</th>
                      <th style={{ padding: '16px 20px' }}>Status</th>
                      <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id || c.client_id}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                              background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.3)'
                            }}>
                              {(c.first_name || '?')[0]}{(c.last_name || '?')[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}
                                onClick={() => navigate(`/clients/${c.client_id || c.id}`)}>
                                {c.first_name} {c.last_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>{c.job_title || '--'}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>
                          {c.wage ? `$${parseFloat(c.wage).toFixed(2)}/${c.wage_type || 'hr'}` : '--'}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                          {c.start_date ? new Date(c.start_date).toLocaleDateString() : '--'}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'active' ? '#10b981' : '#64748b' }} />
                            <span style={{ fontSize: 13 }}>{(c.status || 'active').charAt(0).toUpperCase() + (c.status || 'active').slice(1)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleUnlink(c.client_id || c.id)}>
                            <Unlink size={14} /> Unlink
                          </button>
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

      {/* ── LMIAs Tab ─────────────────────────────────────── */}
      {activeTab === 'lmias' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowLmiaModal(true)}>
              <Plus size={14} /> New LMIA
            </button>
          </div>

          {lmias.length === 0 ? (
            <div className="card"><div className="empty">
              <div className="empty-icon"><FileSearch size={32} /></div>
              <div className="empty-title">No LMIAs yet</div>
              <div className="empty-text">Create an LMIA application for this employer.</div>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {lmias.map(l => (
                <div key={l.id} className="card" style={{ padding: '20px 24px', cursor: 'pointer' }} onClick={() => navigate(`/lmia/${l.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(124,58,237,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.25)'
                      }}>
                        <FileSearch size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{l.job_title || 'Untitled Position'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {l.noc_code && <span>NOC: {l.noc_code}</span>}
                          {l.teer_category && <span>{l.teer_category}</span>}
                          {l.stream && <span>{l.stream}</span>}
                          {l.num_positions && <span>{l.num_positions} position(s)</span>}
                          {l.client_name && <span>Worker: {l.client_name}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${LMIA_STATUS_BADGE[l.status] || 'badge-gray'}`}>
                      {(l.status || 'draft').charAt(0).toUpperCase() + (l.status || 'draft').slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Fees Tab ──────────────────────────────────────── */}
      {activeTab === 'fees' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowFeeModal(true)}>
              <Plus size={14} /> Add Fee
            </button>
          </div>

          {fees.length === 0 ? (
            <div className="card"><div className="empty">
              <div className="empty-icon"><DollarSign size={32} /></div>
              <div className="empty-title">No fees recorded</div>
              <div className="empty-text">Track invoices and payments for this employer.</div>
            </div></div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ padding: '16px 20px' }}>Description</th>
                      <th style={{ padding: '16px 20px' }}>Amount</th>
                      <th style={{ padding: '16px 20px' }}>Status</th>
                      <th style={{ padding: '16px 20px' }}>Invoice Date</th>
                      <th style={{ padding: '16px 20px' }}>Due Date</th>
                      <th style={{ padding: '16px 20px' }}>Paid Date</th>
                      <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map(f => (
                      <tr key={f.id}>
                        <td style={{ padding: '16px 20px', fontWeight: 600, fontSize: 13 }}>{f.description || '--'}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 700, fontSize: 13 }}>
                          ${(parseFloat(f.amount) || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span className={`badge ${FEE_STATUS_BADGE[f.status] || 'badge-gray'}`}>
                            {(f.status || 'unpaid').charAt(0).toUpperCase() + (f.status || 'unpaid').slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                          {f.invoice_date ? new Date(f.invoice_date).toLocaleDateString() : '--'}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                          {f.due_date ? new Date(f.due_date).toLocaleDateString() : '--'}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                          {f.paid_date ? new Date(f.paid_date).toLocaleDateString() : '--'}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          {f.status !== 'paid' && (
                            <button className="btn btn-success btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleMarkPaid(f.id)}>
                              <CheckCircle size={12} /> Mark Paid
                            </button>
                          )}
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

      {/* ── Link Worker Modal ─────────────────────────────── */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title">Link Worker</div>
              <button className="modal-close" onClick={() => setShowLinkModal(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Client *</label>
                <select className="form-select" value={linkForm.client_id} onChange={e => setLinkForm(p => ({ ...p, client_id: e.target.value }))}>
                  <option value="">Select a client...</option>
                  {allClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input className="form-input" value={linkForm.job_title} onChange={e => setLinkForm(p => ({ ...p, job_title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={linkForm.start_date} onChange={e => setLinkForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Wage</label>
                <input className="form-input" type="number" step="0.01" value={linkForm.wage} onChange={e => setLinkForm(p => ({ ...p, wage: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Wage Type</label>
                <select className="form-select" value={linkForm.wage_type} onChange={e => setLinkForm(p => ({ ...p, wage_type: e.target.value }))}>
                  <option value="hourly">Hourly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLinkModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleLinkWorker} disabled={saving || !linkForm.client_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link2 size={14} /> {saving ? 'Linking...' : 'Link Worker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New LMIA Modal ────────────────────────────────── */}
      {showLmiaModal && (
        <div className="modal-overlay" onClick={() => setShowLmiaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div className="modal-title">New LMIA Application</div>
              <button className="modal-close" onClick={() => setShowLmiaModal(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Job Title *</label>
                <input className="form-input" value={lmiaForm.job_title} onChange={e => setLmiaForm(p => ({ ...p, job_title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">NOC Code</label>
                <input className="form-input" value={lmiaForm.noc_code} onChange={e => setLmiaForm(p => ({ ...p, noc_code: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">TEER Category</label>
                <select className="form-select" value={lmiaForm.teer_category} onChange={e => setLmiaForm(p => ({ ...p, teer_category: e.target.value }))}>
                  <option value="">Select TEER...</option>
                  {TEER_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Wage Offered</label>
                <input className="form-input" type="number" step="0.01" value={lmiaForm.wage_offered} onChange={e => setLmiaForm(p => ({ ...p, wage_offered: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Wage Type</label>
                <select className="form-select" value={lmiaForm.wage_type} onChange={e => setLmiaForm(p => ({ ...p, wage_type: e.target.value }))}>
                  <option value="hourly">Hourly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Work Location</label>
                <input className="form-input" value={lmiaForm.work_location} onChange={e => setLmiaForm(p => ({ ...p, work_location: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Number of Positions</label>
                <input className="form-input" type="number" value={lmiaForm.num_positions} onChange={e => setLmiaForm(p => ({ ...p, num_positions: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Stream</label>
                <select className="form-select" value={lmiaForm.stream} onChange={e => setLmiaForm(p => ({ ...p, stream: e.target.value }))}>
                  <option value="">Select Stream...</option>
                  {LMIA_STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group form-full">
                <label className="form-label">Assign Worker (optional)</label>
                <select className="form-select" value={lmiaForm.client_id} onChange={e => setLmiaForm(p => ({ ...p, client_id: e.target.value }))}>
                  <option value="">No worker assigned</option>
                  {clients.map(c => <option key={c.client_id || c.id} value={c.client_id || c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLmiaModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateLmia} disabled={saving || !lmiaForm.job_title} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> {saving ? 'Creating...' : 'Create LMIA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Fee Modal ─────────────────────────────────── */}
      {showFeeModal && (
        <div className="modal-overlay" onClick={() => setShowFeeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title">Add Fee</div>
              <button className="modal-close" onClick={() => setShowFeeModal(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Description *</label>
                <input className="form-input" value={feeForm.description} onChange={e => setFeeForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input className="form-input" type="number" step="0.01" value={feeForm.amount} onChange={e => setFeeForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={feeForm.due_date} onChange={e => setFeeForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Link to LMIA (optional)</label>
                <select className="form-select" value={feeForm.lmia_id} onChange={e => setFeeForm(p => ({ ...p, lmia_id: e.target.value }))}>
                  <option value="">No LMIA linked</option>
                  {lmias.map(l => <option key={l.id} value={l.id}>{l.job_title} ({l.status})</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFeeModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFee} disabled={saving || !feeForm.description || !feeForm.amount} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> {saving ? 'Adding...' : 'Add Fee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
