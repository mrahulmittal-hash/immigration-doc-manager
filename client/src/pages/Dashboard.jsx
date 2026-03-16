import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  Users, CheckCircle, Clock, FileText, Calendar, CreditCard,
  UserPlus, CheckSquare, ArrowRight, BarChart3, Newspaper, AlertTriangle,
  Activity, Globe, GitBranch, Briefcase, Cake, Award, Circle, Check,
  ClipboardList, FolderOpen, Building2
} from 'lucide-react';

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [irccUpdates, setIrccUpdates] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [todayData, setTodayData] = useState({ tasks: [], birthdays: [], anniversaries: [], deadlines: [] });

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getClients(),
      api.getIRCCUpdates(null, 5).catch(() => []),
      api.getUpcomingDeadlines().catch(() => []),
      api.getDashboardToday ? api.getDashboardToday().catch(() => ({ tasks: [], birthdays: [], anniversaries: [], deadlines: [] })) : Promise.resolve({ tasks: [], birthdays: [], anniversaries: [], deadlines: [] }),
    ])
      .then(([s, c, ircc, dl, today]) => {
        setStats(s);
        setClients(c);
        setIrccUpdates(ircc);
        setDeadlines(dl);
        setTodayData(today);
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
    if (days <= 0) return '#ef4444';
    if (days <= 7) return '#f59e0b';
    return '#10b981';
  }

  const toggleTask = async (id) => {
    try {
      if (api.toggleTask) await api.toggleTask(id);
      setTodayData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
    } catch (e) { console.error(e); }
  };

  const hasTodayContent = todayData.tasks.length > 0 || todayData.deadlines.length > 0;

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
            {s.warn && <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 14 }}>!</span>}
            <div className="dash-stat-label">{s.label}</div>
          </div>
        ))}

        {/* Celebrations tile */}
        <div className="dash-stat-card" style={{ cursor: 'default' }}>
          <div className="dash-stat-accent" style={{ background: 'linear-gradient(90deg, #f59e0b, #8b5cf6)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="dash-stat-value" style={{ color: '#8b5cf6' }}>
              {todayData.birthdays.length + todayData.anniversaries.length}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {todayData.birthdays.length > 0 && <Cake size={14} color="#f59e0b" />}
              {todayData.anniversaries.length > 0 && <Award size={14} color="#8b5cf6" />}
            </div>
          </div>
          <div className="dash-stat-label">Celebrations</div>
          {(todayData.birthdays.length > 0 || todayData.anniversaries.length > 0) && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {todayData.birthdays.map(b => (
                <Link key={`b-${b.id}`} to={`/clients/${b.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                  fontSize: 11, color: '#92400e', padding: '3px 6px', borderRadius: 6,
                  background: 'rgba(251,191,36,0.12)',
                }}>
                  <Cake size={10} color="#f59e0b" />
                  <span style={{ fontWeight: 600 }}>{b.first_name} {b.last_name}</span>
                </Link>
              ))}
              {todayData.anniversaries.map(a => (
                <Link key={`a-${a.id}`} to={`/clients/${a.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                  fontSize: 11, color: '#5b21b6', padding: '3px 6px', borderRadius: 6,
                  background: 'rgba(139,92,246,0.08)',
                }}>
                  <Award size={10} color="#8b5cf6" />
                  <span style={{ fontWeight: 600 }}>{a.first_name} {a.last_name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TODAY'S OVERVIEW */}
      {hasTodayContent && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Tasks strip */}
          {todayData.tasks.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  padding: '10px 16px', background: 'linear-gradient(135deg, var(--primary), #0d9488)',
                  display: 'flex', alignItems: 'center', gap: 8, minWidth: 80
                }}>
                  <CheckSquare size={14} color="#fff" />
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {todayData.tasks.filter(t => !t.done).length}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>Tasks</span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', height: 38 }}>
                    <div className="dash-task-marquee">
                      {[...todayData.tasks.filter(t => !t.done), ...todayData.tasks.filter(t => !t.done)].map((t, i) => (
                        <span key={`${t.id}-${i}`} className="dash-task-marquee-item">
                          <Circle size={5} fill={PRIORITY_COLORS[t.priority]} color={PRIORITY_COLORS[t.priority]} style={{ flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{t.title}</span>
                          {t.client && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({t.client})</span>}
                          {t.due_date && (() => {
                            const d = getDaysUntil(t.due_date);
                            return <span style={{ fontSize: 9, fontWeight: 700, color: getUrgencyColor(d), background: `${getUrgencyColor(d)}12`, padding: '1px 5px', borderRadius: 3 }}>
                              {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d`}
                            </span>;
                          })()}
                          <span style={{ color: 'var(--border)', margin: '0 6px', fontSize: 10 }}>·</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <Link to="/tasks" className="btn btn-primary btn-sm" style={{ margin: '0 12px', fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  View All <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}

          {/* Deadlines strip */}
          {todayData.deadlines.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #fff5f5, #fee2e2)', border: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ padding: '10px 16px', background: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                  <AlertTriangle size={14} color="#fff" />
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{todayData.deadlines.length}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' }}>Due</span>
                </div>
                <div style={{ flex: 1, padding: '8px 14px', display: 'flex', gap: 14, overflowX: 'auto' }}>
                  {todayData.deadlines.map(dl => {
                    const days = getDaysUntil(dl.deadline_date);
                    return (
                      <Link key={dl.id} to={`/clients/${dl.client_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        <div style={{ width: 3, height: 24, borderRadius: 2, background: getUrgencyColor(days), flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>{dl.title}</div>
                          <div style={{ fontSize: 10, color: '#dc2626' }}>{dl.first_name} {dl.last_name} · <span style={{ fontWeight: 700, color: getUrgencyColor(days) }}>{days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</span></div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WORKSPACE TILES */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
          YOUR WORKSPACE
        </div>
        <div className="dash-workspace-grid">
          {[
            { to: '/clients', gradient: 'gradient-teal', icon: Users, title: 'Clients', desc: 'Manage clients & immigration cases', badge: active > 0 ? `${active} active` : null },
            { to: '/pipeline', gradient: 'gradient-indigo', icon: GitBranch, title: 'Pipeline', desc: 'Case stage tracking & workflow' },
            { to: '/tasks', gradient: 'gradient-blue', icon: CheckSquare, title: 'Tasks', desc: 'Daily to-do items & follow-ups' },
            { to: '/calendar', gradient: 'gradient-emerald', icon: Calendar, title: 'Calendar', desc: 'View your schedule at a glance' },
            { to: '/retainers', gradient: 'gradient-amber', icon: CreditCard, title: 'Trust Accounting', desc: 'Trust accounts, billing & payments' },
            { to: '/ircc-updates', gradient: 'gradient-violet', icon: Newspaper, title: 'IRCC Updates', desc: 'Latest immigration news & policies' },
            { to: '/ircc-templates', gradient: 'gradient-rose', icon: ClipboardList, title: 'IRCC Forms', desc: 'Fillable application form templates' },
            { to: '/ircc-templates', gradient: 'gradient-cyan', icon: FolderOpen, title: 'Document Templates', desc: 'All forms by visa category', key: 'doc-templates' },
            { to: '/employers', gradient: 'gradient-orange', icon: Building2, title: 'Employers', desc: 'LMIA employers & job offers' },
          ].map(card => (
            <Link key={card.key || card.to} to={card.to} className={`dash-workspace-card ${card.gradient}`}>
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
