import { useState, useEffect } from 'react';
import { Plus, DollarSign, Search, Trash2, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../api';

export default function ServiceFeesTab() {
  const [fees, setFees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ service_name: '', base_fee: 0, gst_rate: 5, description: '', is_active: true });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | inactive
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadFees(); }, []);

  async function loadFees() {
    try {
      const rows = await api.getServiceFees();
      setFees(rows);
    } catch (err) { console.error(err); }
  }

  function handleSelect(fee) {
    setSelected(fee.id);
    setForm({ service_name: fee.service_name, base_fee: fee.base_fee, gst_rate: fee.gst_rate, description: fee.description || '', is_active: fee.is_active !== false && fee.is_active !== 0 });
    setMsg('');
  }

  function handleNew() {
    setSelected('new');
    setForm({ service_name: '', base_fee: 0, gst_rate: 5, description: '', is_active: true });
    setMsg('');
  }

  async function handleSave() {
    if (!form.service_name.trim()) return setMsg('Service name is required');
    setSaving(true);
    try {
      if (selected === 'new') {
        const res = await api.createServiceFee(form);
        setSelected(res.id);
        setMsg('Service fee created');
      } else {
        await api.updateServiceFee(selected, form);
        setMsg('Service fee updated');
      }
      await loadFees();
    } catch (err) { setMsg(err.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!selected || selected === 'new') return;
    try {
      await api.deleteServiceFee(selected);
      setSelected(null);
      setMsg('Service fee deactivated');
      await loadFees();
    } catch (err) { setMsg(err.message); }
  }

  const filtered = fees.filter(f => {
    if (search && !f.service_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'active') return f.is_active !== false && f.is_active !== 0;
    if (filter === 'inactive') return f.is_active === false || f.is_active === 0;
    return true;
  });

  const activeFees = fees.filter(f => f.is_active !== false && f.is_active !== 0);
  const feeRange = activeFees.length ? `$${Math.min(...activeFees.map(f => f.base_fee))} – $${Math.max(...activeFees.map(f => f.base_fee))}` : '—';

  return (
    <div className="clients-3panel" style={{ margin: 0, height: 'calc(100vh - 160px)' }}>
      {/* Left sidebar */}
      <div className="clients-sidebar">
        <button className="clients-add-btn" onClick={handleNew}>
          <Plus size={16} /> Add Service Fee
        </button>
        <div className="clients-sidebar-header">
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {['all', 'active', 'inactive'].map(f => (
              <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="clients-search-wrap">
          <Search size={14} style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <div className="clients-list" style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {filtered.map(fee => (
            <div
              key={fee.id}
              className={`clients-item ${selected === fee.id ? 'active' : ''}`}
              onClick={() => handleSelect(fee)}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: selected === fee.id ? 'var(--primary-glow)' : 'transparent' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{fee.service_name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>${Number(fee.base_fee).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: fee.is_active !== false && fee.is_active !== 0 ? 'var(--accent-green)' : 'var(--text-muted)', marginTop: 2 }}>
                {fee.is_active !== false && fee.is_active !== 0 ? '● Active' : '○ Inactive'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center form */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {selected ? (
          <div className="card" style={{ maxWidth: 600 }}>
            <div className="card-header">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                <DollarSign size={18} style={{ verticalAlign: 'middle' }} />{' '}
                {selected === 'new' ? 'New Service Fee' : 'Edit Service Fee'}
              </h3>
            </div>
            <div style={{ padding: 20 }}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <label className="form-label">Service Name *</label>
                  <input className="form-input" value={form.service_name} onChange={e => setForm({ ...form, service_name: e.target.value })} placeholder="e.g. Permanent Residence - Express Entry" />
                </div>
                <div className="form-grid">
                  <div>
                    <label className="form-label">Base Fee (CAD)</label>
                    <input className="form-input" type="number" value={form.base_fee} onChange={e => setForm({ ...form, base_fee: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="form-label">GST Rate (%)</label>
                    <input className="form-input" type="number" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.is_active ? 'var(--accent-green)' : 'var(--text-muted)' }}
                  >
                    {form.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{form.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.includes('error') || msg.includes('required') ? 'var(--danger)' : 'var(--accent-green)', fontWeight: 600 }}>{msg}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
                {selected !== 'new' && (
                  <button className="btn btn-outline" onClick={handleDelete} style={{ color: 'var(--danger)' }}>
                    <Trash2 size={14} /> Deactivate
                  </button>
                )}
              </div>

              {/* Fee preview */}
              <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-subtle)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>FEE PREVIEW</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Professional Fee</span>
                  <span style={{ fontWeight: 600 }}>CAD ${Number(form.base_fee).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: 'var(--text-secondary)' }}>
                  <span>GST ({form.gst_rate}%)</span>
                  <span>${(form.base_fee * form.gst_rate / 100).toFixed(2)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                  <span>Total</span>
                  <span>CAD ${(form.base_fee * (1 + form.gst_rate / 100)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty">
            <DollarSign size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p>Select a service fee to edit or create a new one</p>
          </div>
        )}
      </div>

      {/* Right stats panel */}
      <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)', padding: 20, background: 'var(--bg-surface)', overflowY: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16 }}>SUMMARY</div>
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{fees.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Services</div>
        </div>
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-green)' }}>{activeFees.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Active Services</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{feeRange}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fee Range</div>
        </div>
      </div>
    </div>
  );
}
