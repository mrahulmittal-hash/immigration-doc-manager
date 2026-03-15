import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  Users, CheckCircle, Clock, FileText, Calendar, CreditCard,
  UserPlus, CheckSquare, ArrowRight, BarChart3, Newspaper, AlertTriangle,
  Activity, Globe, GitBranch, Briefcase
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [irccUpdates, setIrccUpdates] = useState([]);
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getClients(),
      api.getIRCCUpdates(null, 5).catch(() => []),
      api.getUpcomingDeadlines().catch(() => []),
    ])
      .then(([s, c, ircc, dl]) => {
        setStats(s);
        setClients(c);
        setIrccUpdates(ircc);
        setDeadlines(dl);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const active = clients.filter(c => c.status === 'active').length;
  const pending = clients.filter(c => c.pif_status === 'pending').length;

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  function getDaysUntil(ds) {
    return Math.ceil((new Date(ds) - now) / (1000 * 60 * 60 * 24));
  }
  function getUrgencyColor(days) {
    if (days <= 7) return '#ef4444';
    if (days <= 30) return '#f59e0b';
    return '#10b981';
  }

  return (
    <div className="page-enter" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{dateStr}</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0', letterSpacing: '-0.5px' }}>
          {greeting}, RCIC!
        </h1>
      </div>

      {/* Stats */}
      <div className="dash-stats-row">
        {[
          { value: active, label: 'Active Clients', color: '#0d9488' },
          { value: stats?.documents || 0, label: 'Documents', color: '#3b82f6' },
          { value: pending, label: 'PIFs Pending', color: '#f59e0b' },
          { value: deadlines.length, label: 'Upcoming Deadlines', color: '#ef4444', warn: deadlines.length > 0 },
        ].map(s => (
          <div key={s.label} className="dash-stat-card">
            <div className="dash-stat-accent" style={{ background: s.color }} />
            <div className="dash-stat-value" style={{ color: s.color }}>{s.value}</div>
            {s.warn && <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 14 }}>⚠</span>}
            <div className="dash-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Workspace Cards */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
          YOUR WORKSPACE
        </div>
        <div className="dash-workspace-grid">
          {[
            { to: '/clients', gradient: 'gradient-teal', icon: Users, title: 'Clients', desc: 'Manage clients & immigration cases', badge: active > 0 ? `${active} active` : null },
            { to: '/pipeline', gradient: 'gradient-indigo', icon: GitBranch, title: 'Pipeline', desc: 'Case stage tracking & workflow' },
            { to: '/tasks', gradient: 'gradient-blue', icon: CheckSquare, title: 'Tasks', desc: 'Daily to-do items & follow-ups' },
            { to: '/calendar', gradient: 'gradient-emerald', icon: Calendar, title: 'Calendar', desc: 'View your schedule at a glance' },
            { to: '/ircc-updates', gradient: 'gradient-violet', icon: Newspaper, title: 'IRCC Updates', desc: 'Latest immigration news & policies' },
            { to: '/retainers', gradient: 'gradient-amber', icon: CreditCard, title: 'Retainers', desc: 'Financial tracking & billing' },
          ].map(card => (
            <Link key={card.to} to={card.to} className={`dash-workspace-card ${card.gradient}`}>
              <div className="dash-workspace-card-icon"><card.icon size={22} /></div>
              {card.badge && <div className="dash-workspace-card-badge">{card.badge}</div>}
              <div className="dash-workspace-card-title">{card.title}</div>
              <div className="dash-workspace-card-desc">{card.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 }}>
        {/* Recent Clients */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: 15 }}>Recent Clients</div>
            <Link to="/clients" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={12} /></Link>
          </div>
          {stats?.recent_clients?.length > 0 ? (
            <div style={{ margin: '0 -20px' }}>
              {stats.recent_clients.slice(0, 5).map((c, idx) => (
                <Link key={c.id} to={`/clients/${c.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                  borderBottom: idx < 4 ? '1px solid var(--border-light)' : 'none',
                  textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(13,148,136,.15), rgba(15,118,110,.15))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: '#0d9488',
                  }}>
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.visa_type || 'No visa type'}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                    background: c.pif_status === 'completed' ? '#dcfce7' : '#fef3c7',
                    color: c.pif_status === 'completed' ? '#059669' : '#b45309',
                  }}>
                    {c.pif_status === 'completed' ? 'Done' : 'Pending'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No clients yet. <Link to="/clients/new" style={{ color: 'var(--primary)' }}>Add your first client</Link>
            </div>
          )}
        </div>

        {/* Deadlines + IRCC */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}><AlertTriangle size={15} /> Deadlines</div>
            </div>
            {deadlines.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {deadlines.slice(0, 4).map((dl, i) => {
                  const days = getDaysUntil(dl.deadline_date);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-light)' }}>
                      <div style={{ width: 4, height: 28, borderRadius: 2, background: getUrgencyColor(days), flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{dl.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{dl.first_name} {dl.last_name}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: getUrgencyColor(days) }}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No upcoming deadlines</div>
            )}
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}><Newspaper size={15} /> IRCC Updates</div>
              <Link to="/ircc-updates" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>All <ArrowRight size={12} /></Link>
            </div>
            {irccUpdates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {irccUpdates.slice(0, 3).map((u, i) => (
                  <a key={i} href={u.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-light)', textDecoration: 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>{u.title}</div>
                    {u.category && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#0d9488', background: 'rgba(13,148,136,.08)', padding: '1px 6px', borderRadius: 4 }}>
                        {u.category.replace(/_/g, ' ')}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No IRCC updates yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
