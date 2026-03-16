import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Building2, Plus, Search, Users, FileSearch, DollarSign, X } from 'lucide-react';

const STATUS_OPTS = ['all', 'active', 'inactive'];

const PROVINCES = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'
];

const emptyForm = {
  company_name: '', trade_name: '', business_number: '',
  contact_name: '', contact_email: '', contact_phone: '',
  address: '', city: '', province: '', postal_code: '',
  industry: '', num_employees: '', notes: '',
};

export default function Employers() {
  const navigate = useNavigate();
  const [employers, setEmployers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getEmployers().then(setEmployers).finally(() => setLoading(false));
  }, []);

  const filtered = employers.filter(e => {
    const q = search.toLowerCase();
    if (q && !(e.company_name||'').toLowerCase().includes(q) && !(e.contact_name||'').toLowerCase().includes(q) && !(e.contact_email||'').toLowerCase().includes(q) && !(e.industry||'').toLowerCase().includes(q)) return false;
    if (status !== 'all' && e.status !== status) return false;
    return true;
  });

  // Compute stats
  const totalEmployers = employers.length;
  const activeLmias = employers.reduce((s, e) => s + (e.active_lmia_count || 0), 0);
  const workersPlaced = employers.reduce((s, e) => s + (e.worker_count || 0), 0);
  const feesOutstanding = employers.reduce((s, e) => s + (parseFloat(e.fees_outstanding) || 0), 0);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await api.createEmployer(form);
      setEmployers(prev => [...prev, created]);
      setShowModal(false);
      setForm({ ...emptyForm });
    } catch (e) {
      alert(e.message || 'Failed to create employer');
    }
    setSaving(false);
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Employers</div>
          <div className="page-subtitle">Manage employer companies, LMIAs, workers, and billing.</div>
        </div>
        <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Employer
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { Icon: Building2, val: totalEmployers, label: 'Total Employers', color: '#3b82f6' },
          { Icon: FileSearch, val: activeLmias, label: 'Active LMIAs', color: '#8b5cf6' },
          { Icon: Users, val: workersPlaced, label: 'Workers Placed', color: '#10b981' },
          { Icon: DollarSign, val: `$${feesOutstanding.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`, label: 'Fees Outstanding', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                <s.Icon size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: 11, color: 'var(--text-muted)' }}><Search size={14} /></span>
          <input
            placeholder="Search by company, contact, or industry..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {STATUS_OPTS.map(s => (
            <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus(s)}
              style={status === s ? { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff' } : {}}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="spinner-container"><div className="spinner" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Building2 size={32} /></div>
          <div className="empty-title">No employers found</div>
          <div className="empty-text">Try changing your search or filters</div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>+ New Employer</button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '16px 20px' }}>Company Name</th>
                  <th style={{ padding: '16px 20px' }}>Contact</th>
                  <th style={{ padding: '16px 20px' }}>Industry</th>
                  <th style={{ padding: '16px 20px' }}>Workers</th>
                  <th style={{ padding: '16px 20px' }}>Active LMIAs</th>
                  <th style={{ padding: '16px 20px' }}>Fees Outstanding</th>
                  <th style={{ padding: '16px 20px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/employers/${e.id}`)}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                          background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: '#3b82f6',
                          border: '1px solid rgba(59,130,246,0.3)'
                        }}>
                          <Building2 size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{e.company_name}</div>
                          {e.trade_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.trade_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {e.contact_name ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.contact_name}</div> : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No contact</div>}
                      {e.contact_email && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.contact_email}</div>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {e.industry ? <span className="badge badge-primary">{e.industry}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>--</span>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{e.worker_count || 0}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{e.active_lmia_count || 0}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: parseFloat(e.fees_outstanding) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                        ${(parseFloat(e.fees_outstanding) || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.status === 'active' ? '#10b981' : '#64748b' }} />
                        <span style={{ fontSize: 13, color: e.status === 'active' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {(e.status || 'active').charAt(0).toUpperCase() + (e.status || 'active').slice(1)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Employer Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div className="modal-title">New Employer</div>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className="form-input" value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Trade Name</label>
                <input className="form-input" value={form.trade_name} onChange={e => setForm(p => ({ ...p, trade_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Business Number</label>
                <input className="form-input" value={form.business_number} onChange={e => setForm(p => ({ ...p, business_number: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Email</label>
                <input className="form-input" type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input className="form-input" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Province</label>
                <select className="form-select" value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}>
                  <option value="">Select Province</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Postal Code</label>
                <input className="form-input" value={form.postal_code} onChange={e => setForm(p => ({ ...p, postal_code: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Industry</label>
                <input className="form-input" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Number of Employees</label>
                <input className="form-input" type="number" value={form.num_employees} onChange={e => setForm(p => ({ ...p, num_employees: e.target.value }))} />
              </div>
              <div className="form-group form-full">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes} rows={3} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.company_name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> {saving ? 'Creating...' : 'Create Employer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
