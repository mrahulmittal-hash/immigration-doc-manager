import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const PIPELINE_STAGES = ['Lead', 'Consultation', 'Retainer Signed', 'In Progress', 'Submitted', 'Approved'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getClients()])
      .then(([s, c]) => { setStats(s); setClients(c); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const active  = clients.filter(c => c.status === 'active').length;
  const pending = clients.filter(c => c.pif_status === 'pending').length;
  const completed = clients.filter(c => c.pif_status === 'completed').length;

  // Today's date info
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="cd-wrap" style={{ animation: 'pifFadeIn 0.4s ease' }}>
      {/* Hero Header */}
      <div className="cd-hero" style={{ padding: '32px 40px', background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div className="cd-hero-left">
          <div className="cd-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', width: 80, height: 80, fontSize: 32 }}>
            💼
          </div>
          <div className="cd-hero-info">
            <div className="cd-hero-name" style={{ fontSize: 28 }}>{greeting}, RCIC! 👋</div>
            <div className="cd-hero-meta" style={{ marginTop: 4, fontSize: 14 }}>
              <span>📅 {now.toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</span>
              <span>🏢 PropAgent Practice Management</span>
            </div>
          </div>
        </div>
        <div className="cd-hero-actions" style={{ gap: 12 }}>
          <Link to="/pipeline" className="pif-btn pif-btn-secondary" style={{ padding: '10px 20px' }}>📊 View Pipeline</Link>
          <Link to="/clients/new" className="pif-btn pif-btn-primary" style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>+ New Client</Link>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="cd-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="cd-stat-chip" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,.08), rgba(59,130,246,.02))', borderColor: 'rgba(59,130,246,.2)' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(59,130,246,.15)', color: '#60a5fa' }}>👥</div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{stats?.clients || 0}</div>
            <div className="cd-stat-lbl">Total Clients ({active} Active)</div>
          </div>
        </div>
        <div className="cd-stat-chip" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,.08), rgba(16,185,129,.02))', borderColor: 'rgba(16,185,129,.2)' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(16,185,129,.15)', color: '#34d399' }}>✅</div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{completed}</div>
            <div className="cd-stat-lbl">PIFs Completed</div>
          </div>
        </div>
        <div className="cd-stat-chip" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,.08), rgba(245,158,11,.02))', borderColor: 'rgba(245,158,11,.2)' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(245,158,11,.15)', color: '#fbbf24' }}>⏳</div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{pending}</div>
            <div className="cd-stat-lbl">PIFs Pending</div>
          </div>
        </div>
        <div className="cd-stat-chip" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.08), rgba(139,92,246,.02))', borderColor: 'rgba(139,92,246,.2)' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(139,92,246,.15)', color: '#a78bfa' }}>📄</div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{stats?.documents || 0} <span style={{fontSize:14, color:'rgba(255,255,255,.3)'}}>/ {stats?.forms || 0}</span></div>
            <div className="cd-stat-lbl">Docs / Forms</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Recent Clients Card */}
        <div className="pif-form-card" style={{ maxWidth: '100%', margin: 0 }}>
          <div className="pif-step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
            <div>
              <h2 className="pif-step-heading" style={{ fontSize: 18, marginBottom: 2 }}>Recent Clients</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Latest additions to your practice</div>
            </div>
            <Link to="/clients" className="pif-btn pif-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>View All →</Link>
          </div>
          
          <div className="pif-step-content" style={{ padding: 0 }}>
            {stats?.recent_clients?.length > 0 ? (
              <div>
                {stats.recent_clients.map((c, idx) => (
                  <div key={c.id} style={{ 
                    display:'flex', alignItems:'center', gap:16, padding:'16px 24px', 
                    borderBottom: idx < stats.recent_clients.length - 1 ? '1px solid var(--border-light)' : 'none',
                    transition: 'background 0.2s',
                    cursor: 'pointer'
                  }} className="hover-bg">
                    <div className="cd-avatar" style={{ width: 42, height: 42, fontSize: 16 }}>
                      {c.first_name[0]}{c.last_name[0]}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color: '#fff' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize:11, background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 12, color:'rgba(255,255,255,.6)' }}>{c.visa_type || 'No Visa'}</span>
                        <span style={{ fontSize:11, background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 12, color:'rgba(255,255,255,.6)' }}>{c.nationality || 'Unknown'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: c.pif_status === 'completed' ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)',
                          color: c.pif_status === 'completed' ? '#10b981' : '#f59e0b',
                          border: `1px solid ${c.pif_status === 'completed' ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}`
                      }}>
                          {c.pif_status === 'completed' ? '✓ PIF Completed' : '⏳ PIF Pending'}
                      </span>
                      <Link to={`/clients/${c.id}`} className="pif-btn pif-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Open →</Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>No clients yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 20 }}>Create your first client to get started</div>
                <Link to="/clients/new" className="pif-btn pif-btn-primary">+ New Client</Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pipeline & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Pipeline Snapshot */}
          <div className="pif-form-card" style={{ maxWidth: '100%', margin: 0 }}>
            <div className="pif-step-header" style={{ padding: '16px 24px' }}>
              <h2 className="pif-step-heading" style={{ fontSize: 16 }}>Pipeline Snapshot</h2>
            </div>
            <div className="pif-step-content" style={{ padding: '20px 24px' }}>
              {PIPELINE_STAGES.map((stage, i) => {
                const count = Math.max(0, clients.length - i * 2);
                const pct = clients.length ? Math.round((count / clients.length) * 100) : 0;
                const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899','#14b8a6'];
                return (
                  <div key={stage} style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                      <span style={{ fontWeight:600, color: 'rgba(255,255,255,.8)' }}>{stage}</span>
                      <span style={{ color:'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width:`${pct}%`, background:colors[i], borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
              <Link to="/pipeline" className="pif-btn pif-btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>View Full Pipeline →</Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pif-form-card" style={{ maxWidth: '100%', margin: 0 }}>
            <div className="pif-step-header" style={{ padding: '16px 24px' }}>
              <h2 className="pif-step-heading" style={{ fontSize: 16 }}>Quick Actions</h2>
            </div>
            <div className="pif-step-content" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/clients/new" className="pif-btn pif-btn-secondary" style={{ justifyContent: 'flex-start' }}>👤 Add New Client</Link>
              <Link to="/tasks" className="pif-btn pif-btn-secondary" style={{ justifyContent: 'flex-start' }}>✅ Manage Tasks</Link>
              <Link to="/calendar" className="pif-btn pif-btn-secondary" style={{ justifyContent: 'flex-start' }}>📅 Calendar</Link>
              <Link to="/retainers" className="pif-btn pif-btn-secondary" style={{ justifyContent: 'flex-start' }}>💳 Retainers</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
