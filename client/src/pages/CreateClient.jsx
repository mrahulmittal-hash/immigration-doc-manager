import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AlertTriangle, Check, DollarSign, Plus, X, Percent } from 'lucide-react';

export default function CreateClient() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [serviceFees, setServiceFees] = useState([]);
  const [caseManagers, setCaseManagers] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]); // [{fee, discount_type, discount_value}]
  const [form, setForm] = useState({
    first_name:'', last_name:'', email:'', phone:'',
    nationality:'', date_of_birth:'', passport_number:'',
    visa_type:'', notes:'', assigned_to:''
  });

  useEffect(() => {
    api.getActiveServiceFees().then(setServiceFees).catch(() => {});
    api.getCaseManagers().then(setCaseManagers).catch(() => {});
  }, []);

  function set(k, v) { setForm(f => ({...f, [k]: v})); }

  function handleAddService() {
    setSelectedServices(prev => [...prev, { fee: null, discount_type: 'none', discount_value: '' }]);
  }

  function handleServiceSelect(index, serviceName) {
    const fee = serviceFees.find(f => f.service_name === serviceName) || null;
    setSelectedServices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], fee };
      return updated;
    });
    // Set primary visa_type to the first service
    if (index === 0) set('visa_type', serviceName);
  }

  function handleDiscountChange(index, field, value) {
    setSelectedServices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handleRemoveService(index) {
    setSelectedServices(prev => prev.filter((_, i) => i !== index));
    // Update primary visa_type
    if (index === 0) {
      const remaining = selectedServices.filter((_, i) => i !== index);
      set('visa_type', remaining[0]?.fee?.service_name || '');
    }
  }

  function calcServiceFee(svc) {
    if (!svc.fee) return { base: 0, discount: 0, adjusted: 0, gst: 0, total: 0 };
    const base = Number(svc.fee.base_fee);
    let discount = 0;
    if (svc.discount_type === 'percentage' && svc.discount_value) {
      discount = base * Number(svc.discount_value) / 100;
    } else if (svc.discount_type === 'fixed' && svc.discount_value) {
      discount = Number(svc.discount_value);
    }
    discount = Math.min(discount, base); // Can't discount more than base
    const adjusted = base - discount;
    const gstRate = Number(svc.fee.gst_rate || 5);
    const gst = adjusted * gstRate / 100;
    const total = adjusted + gst;
    return { base, discount, adjusted, gst, gstRate, total };
  }

  const grandTotal = selectedServices.reduce((sum, svc) => sum + calcServiceFee(svc).total, 0);

  // Services already selected (to prevent duplicates)
  const selectedServiceNames = selectedServices.map(s => s.fee?.service_name).filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    if (!form.first_name || !form.last_name) { setErr('First name and last name are required.'); return; }

    // Set visa_type to all service names joined
    const serviceNames = selectedServices.map(s => s.fee?.service_name).filter(Boolean);
    const submitForm = {
      ...form,
      visa_type: serviceNames.length > 0 ? serviceNames[0] : form.visa_type,
    };

    setSaving(true); setErr('');
    try {
      const client = await api.createClient(submitForm);

      // Create retainers for each selected service
      for (const svc of selectedServices) {
        if (svc.fee && Number(svc.fee.base_fee) > 0) {
          try {
            const calc = calcServiceFee(svc);
            const retainer = await api.createRetainer(client.id, {
              service_type: svc.fee.service_name,
              retainer_fee: calc.adjusted, // Use discounted fee
            });
            // If there's a discount, create a fee adjustment record
            if (calc.discount > 0 && retainer.id) {
              try {
                await api.createFeeAdjustment(client.id, {
                  retainer_id: retainer.id,
                  type: 'discount',
                  percentage: svc.discount_type === 'percentage' ? Number(svc.discount_value) : 0,
                  amount: svc.discount_type === 'fixed' ? Number(svc.discount_value) : 0,
                  description: `Registration discount${svc.discount_type === 'percentage' ? ` (${svc.discount_value}%)` : ` ($${svc.discount_value})`}`,
                });
              } catch {}
            }
          } catch (retErr) { console.error('Failed to auto-create retainer:', retErr); }
        }
      }

      navigate(`/clients/${client.id}`);
    } catch (e) {
      setErr(e.message || 'Failed to create client');
      setSaving(false);
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Create New Client</h1>
          <p className="page-subtitle">Add a new file to your immigration practice</p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Personal Information</h2>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Given name(s)" required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Family name" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="client@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (000) 000-0000" />
            </div>
            <div className="form-group">
              <label className="form-label">Nationality</label>
              <input className="form-input" value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. Indian, Filipino..." />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-input" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Passport Number</label>
              <input className="form-input" value={form.passport_number} onChange={e => set('passport_number', e.target.value)} placeholder="Passport ID" />
            </div>
            <div className="form-group form-full">
              <label className="form-label">Case Notes</label>
              <textarea className="form-textarea" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any initial assessment or intake notes..." />
            </div>
            <div className="form-group">
              <label className="form-label">Assign Case Manager <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
              <select className="form-input" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">— Assign later —</option>
                {caseManagers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Services & Fees Section */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title">Services & Fees</h2>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddService}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px' }}>
              <Plus size={14} /> Add Service
            </button>
          </div>

          {selectedServices.length === 0 && (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <DollarSign size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No services added yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Service" to select immigration services for this client</div>
            </div>
          )}

          {selectedServices.map((svc, idx) => {
            const calc = calcServiceFee(svc);
            return (
              <div key={idx} style={{
                margin: '0 16px 12px', padding: 16, borderRadius: 10,
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Service dropdown */}
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Service Type
                    </label>
                    <select className="form-select" value={svc.fee?.service_name || ''}
                      onChange={e => handleServiceSelect(idx, e.target.value)}>
                      <option value="">Select a service...</option>
                      {serviceFees.map(sf => (
                        <option key={sf.id} value={sf.service_name}
                          disabled={selectedServiceNames.includes(sf.service_name) && svc.fee?.service_name !== sf.service_name}>
                          {sf.service_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Discount type */}
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Discount
                    </label>
                    <select className="form-select" value={svc.discount_type}
                      onChange={e => handleDiscountChange(idx, 'discount_type', e.target.value)}>
                      <option value="none">No Discount</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>

                  {/* Discount value */}
                  {svc.discount_type !== 'none' && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                        {svc.discount_type === 'percentage' ? '% Off' : '$ Off'}
                      </label>
                      <input
                        type="number" min="0" step="any"
                        className="form-input"
                        value={svc.discount_value}
                        onChange={e => handleDiscountChange(idx, 'discount_value', e.target.value)}
                        placeholder={svc.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                      />
                    </div>
                  )}

                  {/* Remove button */}
                  <button type="button" onClick={() => handleRemoveService(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: 4, marginTop: 20 }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Fee breakdown */}
                {svc.fee && (
                  <div style={{
                    marginTop: 10, padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.12)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarSign size={14} style={{ color: '#6366f1' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          ${calc.base.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                        </span>
                        {calc.discount > 0 && (
                          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                            <Percent size={11} style={{ verticalAlign: 'middle' }} /> -${calc.discount.toLocaleString('en-CA', { minimumFractionDigits: 2 })} discount
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {calc.discount > 0 && (
                          <span>Adjusted: ${calc.adjusted.toLocaleString('en-CA', { minimumFractionDigits: 2 })} · </span>
                        )}
                        GST ({calc.gstRate}%): ${calc.gst.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', marginLeft: 8 }}>
                          Total: ${calc.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    {svc.fee.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{svc.fee.description}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand Total */}
          {selectedServices.length > 0 && selectedServices.some(s => s.fee) && (
            <div style={{
              margin: '4px 16px 16px', padding: '12px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))',
              border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                GRAND TOTAL ({selectedServices.filter(s => s.fee).length} service{selectedServices.filter(s => s.fee).length !== 1 ? 's' : ''})
              </span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#059669' }}>
                ${grandTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {err && (
          <div style={{
            marginTop: 16, padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 8, color: 'var(--accent-red)', fontSize: 13, display:'flex', alignItems:'center', gap:8
          }}>
            <AlertTriangle size={16} /> {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/clients')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{display:'flex',alignItems:'center',gap:6}}>
            {saving ? 'Creating Client...' : <><Check size={14} /> Create Client</>}
          </button>
        </div>
      </form>
    </div>
  );
}
