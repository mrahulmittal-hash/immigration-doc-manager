import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import {
  DollarSign, Plus, X, Loader, ChevronDown, ChevronUp, Calculator,
  CheckCircle, Clock, AlertTriangle, Users,
} from 'lucide-react';

const STATUS_COLORS = {
  draft: 'badge-gray', finalized: 'badge-warning', paid: 'badge-success',
  pending: 'badge-warning', partial: 'badge-warning',
};

const PROVINCES = [
  { code: 'ON', name: 'Ontario' }, { code: 'BC', name: 'British Columbia' }, { code: 'AB', name: 'Alberta' },
  { code: 'SK', name: 'Saskatchewan' }, { code: 'MB', name: 'Manitoba' }, { code: 'QC', name: 'Quebec' },
  { code: 'NB', name: 'New Brunswick' }, { code: 'NS', name: 'Nova Scotia' }, { code: 'PE', name: 'PEI' },
  { code: 'NL', name: 'Newfoundland' },
];

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

export default function Payroll() {
  const [data, setData] = useState({ runs: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [employers, setEmployers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState({
    employer_id: '', client_id: '', employer_client_id: '',
    pay_period_start: '', pay_period_end: '',
    hours_worked: '', hourly_rate: '',
    province: 'ON', pay_frequency: 'biweekly', notes: '',
  });
  const [calcResult, setCalcResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ runId: null, amount: '', reference: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const d = await api.getPayrollRuns(); setData(d); }
    catch { setData({ runs: [], stats: {} }); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.getEmployers().then(d => setEmployers(Array.isArray(d) ? d : d.employers || [])).catch(() => {});
  }, []);

  const handleEmployerChange = async (employerId) => {
    setForm(f => ({ ...f, employer_id: employerId, client_id: '', employer_client_id: '', hourly_rate: '' }));
    setWorkers([]);
    setCalcResult(null);
    if (!employerId) return;
    try {
      const w = await api.getEmployerClients(employerId);
      setWorkers(Array.isArray(w) ? w : []);
    } catch { setWorkers([]); }
  };

  const handleWorkerChange = (ecId) => {
    const ec = workers.find(w => String(w.id) === String(ecId));
    setForm(f => ({
      ...f,
      employer_client_id: ecId,
      client_id: ec?.client_id || '',
      hourly_rate: ec?.wage || '',
    }));
    setCalcResult(null);
  };

  const handleCalculate = async () => {
    if (!form.employer_id || !form.client_id || !form.hours_worked || !form.hourly_rate || !form.pay_period_start || !form.pay_period_end) return;
    setSaving(true);
    try {
      const result = await api.createPayrollRun(form);
      setCalcResult(result);
    } catch (e) { alert(e.message || 'Calculation failed'); }
    setSaving(false);
  };

  const handleFinalize = async (id) => {
    setActionLoading(id);
    try { await api.finalizePayrollRun(id); fetchData(); }
    catch (e) { alert(e.message); }
    setActionLoading(null);
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.runId || !paymentForm.amount) return;
    setActionLoading(paymentForm.runId);
    try {
      await api.recordWorkerPayment(paymentForm.runId, { amount: parseFloat(paymentForm.amount), reference_number: paymentForm.reference });
      setPaymentForm({ runId: null, amount: '', reference: '' });
      fetchData();
    } catch (e) { alert(e.message); }
    setActionLoading(null);
  };

  const handleRelease = async (id) => {
    setActionLoading(id);
    try { await api.releaseToEmployer(id, {}); fetchData(); }
    catch (e) { alert(e.message); }
    setActionLoading(null);
  };

  const closeForm = () => { setShowForm(false); setCalcResult(null); setForm({ employer_id: '', client_id: '', employer_client_id: '', pay_period_start: '', pay_period_end: '', hours_worked: '', hourly_rate: '', province: 'ON', pay_frequency: 'biweekly', notes: '' }); };

  const activeRuns = data.runs.filter(r => r.status !== 'paid');
  const historyRuns = data.runs.filter(r => r.status === 'paid');
  const displayRuns = tab === 'active' ? activeRuns : historyRuns;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">Manage payroll runs for LMIA workers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> New Payroll Run
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-icon"><Calculator size={22} /></div>
          <div className="stat-value">{data.stats.total_runs || 0}</div>
          <div className="stat-label">Total Runs</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><DollarSign size={22} /></div>
          <div className="stat-value">{fmt(data.stats.total_gross)}</div>
          <div className="stat-label">Total Gross Pay</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon"><Clock size={22} /></div>
          <div className="stat-value">{fmt(data.stats.outstanding_worker)}</div>
          <div className="stat-label">Outstanding Worker</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon"><AlertTriangle size={22} /></div>
          <div className="stat-value">{data.stats.pending_employer || 0}</div>
          <div className="stat-label">Pending Employer</div>
        </div>
      </div>

      {/* New Payroll Run Form */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>New Payroll Run</h3>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Employer *</label>
              <select className="form-select" value={form.employer_id} onChange={e => handleEmployerChange(e.target.value)}>
                <option value="">Select employer...</option>
                {employers.map(e => <option key={e.id} value={e.id}>{e.company_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Worker *</label>
              <select className="form-select" value={form.employer_client_id} onChange={e => handleWorkerChange(e.target.value)} disabled={!form.employer_id}>
                <option value="">Select worker...</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name} — {w.job_title || 'N/A'} ({w.wage_type === 'hourly' ? `$${w.wage}/hr` : `$${w.wage}/yr`})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Period Start *</label>
              <input className="form-input" type="date" value={form.pay_period_start} onChange={e => setForm(f => ({ ...f, pay_period_start: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Period End *</label>
              <input className="form-input" type="date" value={form.pay_period_end} onChange={e => setForm(f => ({ ...f, pay_period_end: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hours Worked *</label>
              <input className="form-input" type="number" step="0.5" placeholder="80" value={form.hours_worked} onChange={e => setForm(f => ({ ...f, hours_worked: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hourly Rate *</label>
              <input className="form-input" type="number" step="0.01" placeholder="20.00" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Province</label>
              <select className="form-select" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}>
                {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Pay Frequency</label>
              <select className="form-select" value={form.pay_frequency} onChange={e => setForm(f => ({ ...f, pay_frequency: e.target.value }))}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="semi-monthly">Semi-monthly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCalculate} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={14} /> {saving ? 'Calculating...' : 'Calculate & Save Draft'}
            </button>
          </div>

          {/* Calculation Result */}
          {calcResult && (
            <div style={{ marginTop: 16, background: 'var(--bg-elevated)', borderRadius: 12, padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--accent-green)' }}>Payroll Breakdown</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Pay</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(calcResult.gross_pay)}</div>
                </div>
                <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Pay</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{fmt(calcResult.net_pay)}</div>
                </div>
                <div className="card" style={{ padding: 12, textAlign: 'center', background: 'rgba(239,68,68,0.05)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Worker Owes</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{fmt(calcResult.total_employer_cost)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Federal Tax:</span> <strong>{fmt(calcResult.federal_tax)}</strong></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Provincial Tax:</span> <strong>{fmt(calcResult.provincial_tax)}</strong></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>CPP (Employee):</span> <strong>{fmt(calcResult.cpp_employee)}</strong></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>CPP (Employer):</span> <strong>{fmt(calcResult.cpp_employer)}</strong></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>EI (Employee):</span> <strong>{fmt(calcResult.ei_employee)}</strong></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>EI (Employer):</span> <strong>{fmt(calcResult.ei_employer)}</strong></div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Total Deductions:</span> <strong style={{ color: '#ef4444' }}>{fmt(calcResult.total_deductions)}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={() => { handleFinalize(calcResult.id); closeForm(); fetchData(); }}>
                  Finalize Now
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <button className={`filter-pill ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          Active Runs ({activeRuns.length})
        </button>
        <button className={`filter-pill ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          History ({historyRuns.length})
        </button>
      </div>

      {/* Runs Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Loader size={28} className="spin" /></div>
      ) : displayRuns.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          {tab === 'active' ? 'No active payroll runs' : 'No completed payroll runs'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayRuns.map(run => (
            <div key={run.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {run.first_name} {run.last_name}
                    <span className={`badge ${STATUS_COLORS[run.status] || 'badge-gray'}`} style={{ fontSize: 10 }}>{run.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {run.company_name} | {run.job_title || 'Worker'} | {run.hours_worked}h @ ${run.hourly_rate}/hr
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {run.pay_period_start && new Date(run.pay_period_start).toLocaleDateString()} — {run.pay_period_end && new Date(run.pay_period_end).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(run.gross_pay)}</div>
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Net: {fmt(run.net_pay)}</div>
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Owes: {fmt(run.total_employer_cost)}</div>
                </div>
              </div>

              {/* Status badges */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: run.worker_payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                  Worker: {run.worker_payment_status} ({fmt(run.worker_paid_amount)}/{fmt(run.total_employer_cost)})
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: run.employer_payment_status === 'paid' ? '#10b981' : '#6366f1' }}>
                  Employer: {run.employer_payment_status}
                </span>

                {/* Actions */}
                {run.status === 'draft' && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleFinalize(run.id)} disabled={actionLoading === run.id} style={{ marginLeft: 'auto', fontSize: 11 }}>
                    {actionLoading === run.id ? 'Processing...' : 'Finalize'}
                  </button>
                )}
                {run.status === 'finalized' && run.worker_payment_status !== 'paid' && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {paymentForm.runId === run.id ? (
                      <>
                        <input className="form-input" type="number" placeholder="Amount" value={paymentForm.amount}
                          onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} style={{ width: 100, fontSize: 12 }} />
                        <input className="form-input" placeholder="Ref#" value={paymentForm.reference}
                          onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} style={{ width: 80, fontSize: 12 }} />
                        <button className="btn btn-primary btn-sm" onClick={handleRecordPayment} disabled={actionLoading === run.id} style={{ fontSize: 11 }}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPaymentForm({ runId: null, amount: '', reference: '' })} style={{ fontSize: 11 }}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => setPaymentForm({ runId: run.id, amount: String(parseFloat(run.total_employer_cost) - parseFloat(run.worker_paid_amount || 0)), reference: '' })} style={{ fontSize: 11 }}>
                        Record Worker Payment
                      </button>
                    )}
                  </div>
                )}
                {run.status === 'finalized' && run.worker_payment_status === 'paid' && run.employer_payment_status !== 'paid' && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleRelease(run.id)} disabled={actionLoading === run.id} style={{ marginLeft: 'auto', fontSize: 11 }}>
                    {actionLoading === run.id ? 'Releasing...' : 'Release to Employer'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
