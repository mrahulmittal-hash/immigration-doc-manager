import { useState, useEffect } from 'react';
import { Plus, Trash2, Percent, DollarSign, X } from 'lucide-react';
import { api } from '../api';

export default function FeeAdjustmentsPanel({ clientId, retainerId, baseFee = 0, onTotalChange }) {
  const [adjustments, setAdjustments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'discount', amount: 0, percentage: 0, description: '' });
  const [adjustedTotal, setAdjustedTotal] = useState(null);

  useEffect(() => { loadData(); }, [clientId, retainerId]);

  async function loadData() {
    try {
      const rows = await api.getFeeAdjustments(clientId);
      setAdjustments(retainerId ? rows.filter(a => a.retainer_id == retainerId) : rows);
      if (retainerId) {
        const calc = await api.getRetainerAdjustedTotal(retainerId);
        setAdjustedTotal(calc);
        if (onTotalChange) onTotalChange(calc);
      }
    } catch (err) { console.error(err); }
  }

  async function handleAdd() {
    if (!form.type) return;
    try {
      await api.createFeeAdjustment(clientId, { ...form, retainer_id: retainerId });
      setShowAdd(false);
      setForm({ type: 'discount', amount: 0, percentage: 0, description: '' });
      await loadData();
    } catch (err) { console.error(err); }
  }

  async function handleDelete(id) {
    try {
      await api.deleteFeeAdjustment(id);
      await loadData();
    } catch (err) { console.error(err); }
  }

  const typeColors = { discount: '#10b981', waiver: '#f59e0b', surcharge: '#ef4444' };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>FEE ADJUSTMENTS</span>
        <button onClick={() => setShowAdd(true)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={13} /> Add
        </button>
      </div>

      {adjustments.length === 0 && !showAdd && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>No adjustments</div>
      )}

      {adjustments.map(adj => (
        <div key={adj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-subtle)', marginBottom: 4, fontSize: 12 }}>
          <div>
            <span style={{ fontWeight: 600, color: typeColors[adj.type] || 'var(--text-primary)', textTransform: 'capitalize' }}>
              {adj.type}
            </span>
            {adj.description && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>— {adj.description}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>
              {adj.percentage > 0 ? `${adj.percentage}%` : `$${Number(adj.amount).toFixed(2)}`}
            </span>
            <button onClick={() => handleDelete(adj.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      {/* Adjusted total summary */}
      {adjustedTotal && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--primary-glow)', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Base Fee</span><span>${Number(adjustedTotal.base_fee).toFixed(2)}</span>
          </div>
          {adjustedTotal.adjustments_total !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, color: adjustedTotal.adjustments_total < 0 ? '#10b981' : '#ef4444' }}>
              <span>Adjustments</span><span>{adjustedTotal.adjustments_total < 0 ? '-' : '+'}${Math.abs(adjustedTotal.adjustments_total).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, color: 'var(--text-muted)' }}>
            <span>GST ({adjustedTotal.gst_rate}%)</span><span>${Number(adjustedTotal.gst).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--primary)', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}>
            <span>Total</span><span>CAD ${Number(adjustedTotal.grand_total).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Add adjustment form */}
      {showAdd && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>New Adjustment</span>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="discount">Discount</option>
                <option value="waiver">Waiver</option>
                <option value="surcharge">Surcharge</option>
              </select>
            </div>
            <div>
              <label className="form-label">Percentage (%)</label>
              <input className="form-input" type="number" value={form.percentage} onChange={e => setForm({ ...form, percentage: Number(e.target.value), amount: 0 })} />
            </div>
            <div>
              <label className="form-label">Or Fixed Amount ($)</label>
              <input className="form-input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value), percentage: 0 })} />
            </div>
            <div>
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Reason..." />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleAdd} style={{ fontSize: 12, padding: '6px 14px' }}>
            <Plus size={13} /> Add Adjustment
          </button>
        </div>
      )}
    </div>
  );
}
