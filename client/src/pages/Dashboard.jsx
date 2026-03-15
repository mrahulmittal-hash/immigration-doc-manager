import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  Briefcase, Users, CheckCircle, Clock, FileText, Calendar, CreditCard,
  UserPlus, CheckSquare, ArrowRight, BarChart3, Newspaper, AlertTriangle,
  Activity, Zap, Globe
} from 'lucide-react';

const PIPELINE_STAGES = ['Lead', 'Consultation', 'Retainer Signed', 'In Progress', 'Submitted', 'Approved'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [irccUpdates, setIrccUpdates] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getClients(),
      api.getIRCCUpdates(null, 5).catch(() => []),
      api.getUpcomingDeadlines().catch(() => []),
      api.getRecentTimeline(8).catch(() => []),
    ])
      .then(([s, c, ircc, dl, activity]) => {
        setStats(s);
        setClients(c);
        setIrccUpdates(ircc);
        setDeadlines(dl);
        setRecentActivity(activity);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const active = clients.filter(c => c.status === 'active').length;
  const pending = clients.filter(c => c.pif_status === 'pending').length;
  const completed = clients.filter(c => c.pif_status === 'completed').length;

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  function getDaysUntil(dateStr) {
    const d = new Date(dateStr);
    const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function getUrgencyColor(days) {
    if (days < 0) return '#ef4444';
    if (days <= 7) return '#ef4444';
    if (days <= 30) return '#f59e0b';
    return '#10b981';
  }

  return (
    <div className="cd-wrap page-enter">
      {/* Hero Header */}
      <div className="cd-hero" style={{ padding: '32px 40px' }}>
        <div className="cd-hero-left">
          <div className="cd-avatar" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', width: 80, height: 80, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={32} color="#fff" />
          </div>
          <div className="cd-hero-info">
            <div className="cd-hero-name" style={{ fontSize: 28 }}>{greeting}, RCIC!</div>
            <div className="cd-hero-meta" style={{ marginTop: 4, fontSize: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} /> {now.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase size={14} /> PropAgent Practice Management</span>
            </div>
          </div>
        </div>
        <div className="cd-hero-actions" style={{ gap: 12 }}>
          <Link to="/pipeline" className="btn btn-secondary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={14} /> View Pipeline</Link>
          <Link to="/clients/new" className="btn btn-success" style={{ padding: '10px 20px' }}>+ New Client</Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="cd-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="cd-stat-chip" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(59,130,246,.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={20} /></div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{stats?.clients || 0}</div>
            <div className="cd-stat-lbl">Total Clients ({active} Active)</div>
          </div>
        </div>
        <div className="cd-stat-chip" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(16,185,129,.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={20} /></div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{completed}</div>
            <div className="cd-stat-lbl">PIFs Completed</div>
          </div>
        </div>
        <div className="cd-stat-chip" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(245,158,11,.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={20} /></div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{pending}</div>
            <div className="cd-stat-lbl">PIFs Pending</div>
          </div>
        </div>
        <div className="cd-stat-chip" style={{ borderLeft: '3px solid #8b5cf6' }}>
          <div className="cd-stat-icon" style={{ background: 'rgba(139,92,246,.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={20} /></div>
          <div>
            <div className="cd-stat-val" style={{ fontSize: 24 }}>{stats?.documents || 0} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {stats?.forms || 0}</span></div>
            <div className="cd-stat-lbl">Docs / Forms</div>
          </div>
        </div>
      </div>

      {/* Main Grid: 60/40 split */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Recent Activity */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16 }}><Activity size={16} /> Recent Activity</div>
                <div className="card-subtitle">Latest events across all clients</div>
              </div>
            </div>
            {recentActivity.length > 0 ? (
              <div style={{ margin: '0 -20px' }}>
                {recentActivity.slice(0, 8).map((ev, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                    borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: ev.event_type === 'document_upload' ? '#3b82f6'
                        : ev.event_type === 'note' ? '#6366f1'
                        : ev.event_type === 'form_filled' ? '#10b981' : '#9ca3af'
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                      {ev.first_name && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {ev.first_name} {ev.last_name}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(ev.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No recent activity. Upload documents or add notes to see activity here.
              </div>
            )}
          </div>

          {/* Recent Clients */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ fontSize: 16 }}>Recent Clients</div>
                <div className="card-subtitle">Latest additions to your practice</div>
              </div>
              <Link to="/clients" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={12} /></Link>
            </div>
            {stats?.recent_clients?.length > 0 ? (
              <div style={{ margin: '0 -20px' }}>
                {stats.recent_clients.map((c, idx) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                    borderBottom: idx < stats.recent_clients.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <div className="cd-avatar" style={{ width: 42, height: 42, fontSize: 14 }}>
                      {c.first_name[0]}{c.last_name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 11, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-secondary)' }}>{c.visa_type || 'No Visa'}</span>
                        {c.nationality && <span style={{ fontSize: 11, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Globe size={9} /> {c.nationality}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className={`badge ${c.pif_status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {c.pif_status === 'completed' ? <><CheckCircle size={12} /> Done</> : <><Clock size={12} /> Pending</>}
                      </span>
                      <Link to={`/clients/${c.id}`} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Open <ArrowRight size={12} /></Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                <div className="empty-icon"><UserPlus size={28} /></div>
                <div className="empty-title">No clients yet</div>
                <Link to="/clients/new" className="btn btn-primary" style={{ marginTop: 12 }}>+ New Client</Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* IRCC Updates Widget */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Newspaper size={16} /> IRCC Updates</div>
              <Link to="/ircc-updates" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>All <ArrowRight size={12} /></Link>
            </div>
            {irccUpdates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {irccUpdates.slice(0, 4).map((update, i) => (
                  <a key={i} href={update.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-light)', textDecoration: 'none', transition: 'box-shadow 0.2s' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>
                      {update.title}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {update.category && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5', background: 'rgba(79,70,229,.08)', padding: '1px 6px', borderRadius: 4 }}>
                          {update.category.replace(/_/g, ' ')}
                        </span>
                      )}
                      {update.published_date && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{update.published_date}</span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No IRCC updates yet. <Link to="/ircc-updates" style={{ color: 'var(--primary)' }}>Trigger a scrape</Link>
              </div>
            )}
          </div>

          {/* Upcoming Deadlines Widget */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} /> Upcoming Deadlines</div>
            </div>
            {deadlines.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {deadlines.slice(0, 5).map((dl, i) => {
                  const days = getDaysUntil(dl.deadline_date);
                  const urgencyColor = getUrgencyColor(days);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-light)' }}>
                      <div style={{ width: 4, height: 32, borderRadius: 2, background: urgencyColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{dl.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {dl.first_name} {dl.last_name} — {new Date(dl.deadline_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: urgencyColor }}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No upcoming deadlines
              </div>
            )}
          </div>

          {/* Pipeline Snapshot */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Pipeline Snapshot</div>
            <div>
              {PIPELINE_STAGES.map((stage, i) => {
                const count = Math.max(0, clients.length - i * 2);
                const pct = clients.length ? Math.round((count / clients.length) * 100) : 0;
                const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6'];
                return (
                  <div key={stage} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stage}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: colors[i] }} />
                    </div>
                  </div>
                );
              })}
              <Link to="/pipeline" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>View Full Pipeline <ArrowRight size={12} /></Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/clients/new" className="btn btn-ghost" style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={16} /> Add New Client</Link>
              <Link to="/tasks" className="btn btn-ghost" style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}><CheckSquare size={16} /> Manage Tasks</Link>
              <Link to="/calendar" className="btn btn-ghost" style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16} /> Calendar</Link>
              <Link to="/ircc-updates" className="btn btn-ghost" style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}><Newspaper size={16} /> IRCC Updates</Link>
              <Link to="/retainers" className="btn btn-ghost" style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}><CreditCard size={16} /> Retainers</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
