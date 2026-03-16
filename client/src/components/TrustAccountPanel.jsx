import { useState, useEffect } from 'react';
import { Wallet, ArrowDownToLine, ArrowUpFromLine, RotateCcw, History } from 'lucide-react';
import TransactionModal from './TransactionModal';
import MilestoneTracker from './MilestoneTracker';

export default function TrustAccountPanel({ clientId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null);
  const [toast, setToast] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/trust`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Failed to load trust data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleReleaseMilestone = async (milestoneId) => {
    const res = await fetch(`/api/milestones/${milestoneId}/release`, { method: 'POST' });
    const result = await res.json();
    if (result.error) {
      setToast(result.error);
    } else {
      setToast('Milestone released');
      load();
    }
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading trust account...</div>;

  const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderRadius: 12 }}>
          <Wallet size={20} style={{ color: '#6366f1', marginBottom: 6 }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>{fmt(data?.trust_balance)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Trust Balance</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderRadius: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{fmt(data?.total_deposited)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Deposited</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderRadius: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{fmt(data?.total_released)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Released</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderRadius: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{fmt(data?.total_refunded)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Refunded</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setModalType('deposit')} style={{ background: '#10b981', borderColor: '#10b981' }}>
          <ArrowDownToLine size={14} /> Deposit
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setModalType('release')} style={{ background: '#6366f1', borderColor: '#6366f1' }}>
          <ArrowUpFromLine size={14} /> Release
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setModalType('refund')}>
          <RotateCcw size={14} /> Refund
        </button>
      </div>

      {/* Milestones */}
      {data?.milestones?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <MilestoneTracker milestones={data.milestones} onRelease={handleReleaseMilestone} />
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <History size={16} style={{ color: 'var(--text-muted)' }} />
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Recent Transactions</h4>
        </div>
        {(!data?.transactions || data.transactions.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No transactions yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.transactions.slice(0, 10).map(tx => {
              const isDebit = tx.type === 'trust_to_operating' || tx.type === 'refund';
              return (
                <div key={tx.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13,
                }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{tx.description || tx.type.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(tx.created_at).toLocaleDateString()} • {tx.type.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: isDebit ? '#ef4444' : '#10b981' }}>
                    {isDebit ? '-' : '+'}{fmt(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {modalType && (
        <TransactionModal
          type={modalType}
          clientId={clientId}
          onComplete={() => { setModalType(null); load(); setToast('Transaction recorded'); setTimeout(() => setToast(''), 3000); }}
          onClose={() => setModalType(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 20px',
          background: '#1a1a2e', color: '#fff', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
