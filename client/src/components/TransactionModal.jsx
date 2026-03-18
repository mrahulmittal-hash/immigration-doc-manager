import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { API_URL } from '../api';

const TYPE_CONFIG = {
  deposit: { label: 'Deposit to Trust', color: '#10b981', verb: 'Deposit' },
  release: { label: 'Release to Operating', color: '#6366f1', verb: 'Release' },
  refund: { label: 'Refund to Client', color: '#f59e0b', verb: 'Refund' },
};

export default function TransactionModal({ type, clientId, onComplete, onClose }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [pipelineStage, setPipelineStage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.deposit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const endpoint = type === 'deposit' ? 'deposit' : type === 'release' ? 'release' : 'refund';
      const res = await fetch(`${API_URL}/api/clients/${clientId}/trust/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description: description || undefined,
          reference_number: referenceNumber || undefined,
          pipeline_stage: pipelineStage || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onComplete();
    } catch (err) {
      setError(err.message || 'Transaction failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: config.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <DollarSign size={20} color="#fff" />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{config.label}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Amount ($CAD)</label>
            <input
              type="number"
              className="form-input"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input
              type="text"
              className="form-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'deposit' ? 'e.g., Initial retainer deposit' : type === 'release' ? 'e.g., Milestone: Documents submitted' : 'e.g., Unused retainer refund'}
            />
          </div>

          {type === 'deposit' && (
            <div className="form-group">
              <label className="form-label">Reference Number (optional)</label>
              <input
                type="text"
                className="form-input"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="e.g., e-Transfer #, cheque #"
              />
            </div>
          )}

          {type === 'release' && (
            <div className="form-group">
              <label className="form-label">Pipeline Stage (optional)</label>
              <select className="form-input" value={pipelineStage} onChange={e => setPipelineStage(e.target.value)}>
                <option value="">Select milestone...</option>
                <option value="consultation">Consultation completed</option>
                <option value="retainer_signed">Retainer signed</option>
                <option value="in_progress">Documents & preparation</option>
                <option value="submitted">Application submitted</option>
                <option value="approved">Application approved</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ background: config.color, borderColor: config.color }}
            >
              {saving ? 'Processing...' : `${config.verb} $${parseFloat(amount || 0).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
