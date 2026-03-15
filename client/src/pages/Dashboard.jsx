import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  Users, CheckCircle, Clock, FileText, Calendar, CreditCard,
  UserPlus, CheckSquare, ArrowRight, BarChart3, Newspaper, AlertTriangle,
  Activity, Globe, GitBranch, Briefcase, Cake, Award, Circle, Check
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
      api.getDashboardToday().catch(() => ({ tasks: [], birthdays: [], anniversaries: [], deadlines: [] })),
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
      await api.toggleTask(id);
      setTodayData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
    } catch (e) { console.error(e); }
  };

  const hasTodayContent = todayData.tasks.length > 0 || todayData.birthdays.length > 0 || todayData.anniversaries.length > 0;

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
      </div>

      {/* ═══ TODAY'S OVERVIEW ═══ */}
      {hasTodayContent && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            TODAY'S OVERVIEW
          </div>

          {/* ── Tasks Banner ────────────────────── */}
          {todayData.tasks.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {/* Task count badge */}
                <div style={{
                  padding: '16px 20px', background: 'linear-gradient(135deg, var(--primary), #0d9488)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  minWidth: 90, gap: 2
                }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {todayData.tasks.filter(t => !t.done).length}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tasks Due
                  </div>
                </div>

                {/* Scrolling marquee banner */}
                <div style={{ flex: 1, overflow: 'hidden', padding: '0 16px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', height: 50 }}>
                    <div className="dash-task-marquee">
                      {todayData.tasks.filter(t => !t.done).map((t, i) => (
                        <span key={t.id} className="dash-task-marquee-item">
                          <Circle size={6} fill={PRIORITY_COLORS[t.priority]} color={PRIORITY_COLORS[t.priority]} style={{ flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{t.title}</span>
                          {t.client && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— {t.client}</span>}
                          {t.due_date && (() => {
                            const d = getDaysUntil(t.due_date);
                            return <span style={{ fontSize: 10, fontWeight: 700, color: getUrgencyColor(d), background: `${getUrgencyColor(d)}15`, padding: '1px 6px', borderRadius: 4 }}>
                              {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `in ${d}d`}
                            </span>;
                          })()}
                          {i < todayData.tasks.filter(t2 => !t2.done).length - 1 && (
                            <span style={{ color: 'var(--border)', margin: '0 8px' }}>│</span>
                          )}
                        </span>
                      ))}
                      {/* Duplicate for seamless loop */}
                      {todayData.tasks.filter(t => !t.done).map((t, i) => (
                        <span key={`dup-${t.id}`} className="dash-task-marquee-item">
                          <Circle size={6} fill={PRIORITY_COLORS[t.priority]} color={PRIORITY_COLORS[t.priority]} style={{ flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{t.title}</span>
                          {t.client && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— {t.client}</span>}
                          {t.due_date && (() => {
                            const d = getDaysUntil(t.due_date);
                            return <span style={{ fontSize: 10, fontWeight: 700, color: getUrgencyColor(d), background: `${getUrgencyColor(d)}15`, padding: '1px 6px', borderRadius: 4 }}>
                              {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `in ${d}d`}
                            </span>;
                          })()}
                          {i < todayData.tasks.filter(t2 => !t2.done).length - 1 && (
                            <span style={{ color: 'var(--border)', margin: '0 8px' }}>│</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* View All button */}
                <Link to="/tasks" className="btn btn-primary btn-sm" style={{ margin: '0 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: '8px 16px' }}>
                  View All Tasks <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}

          {/* ── Subsection Cards Grid ───────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

            {/* Birthdays Card */}
            {todayData.birthdays.length > 0 && (
              <div className="card" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cake size={16} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>🎂 Birthdays This Week</div>
                      <div style={{ fontSize: 11, color: '#b45309' }}>{todayData.birthdays.length} client{todayData.birthdays.length > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
                {todayData.birthdays.map(b => (
                  <div key={b.id} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(146,64,14,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#92400e' }}>
                        {b.first_name[0]}{b.last_name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{b.first_name} {b.last_name}</div>
                        <div style={{ fontSize: 11, color: '#b45309' }}>Turning {b.age} · {b.visa_type || 'Client'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/clients/${b.id}`} style={{ fontSize: 11, fontWeight: 600, color: '#92400e', background: 'rgba(146,64,14,0.1)', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={11} /> View Profile
                      </Link>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, fontWeight: 600, color: '#92400e', background: 'rgba(251,191,36,0.2)', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => window.open(`mailto:${b.email || ''}?subject=Happy Birthday ${b.first_name}!&body=Dear ${b.first_name},%0D%0A%0D%0AWishing you a very Happy Birthday! 🎂%0D%0A%0D%0ABest regards`, '_blank')}>
                        <Cake size={11} /> Send Wishes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Anniversaries Card */}
            {todayData.anniversaries.length > 0 && (
              <div className="card" style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1px solid #ddd6fe', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Award size={16} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#5b21b6' }}>🏆 Case Anniversaries</div>
                      <div style={{ fontSize: 11, color: '#7c3aed' }}>{todayData.anniversaries.length} client{todayData.anniversaries.length > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
                {todayData.anniversaries.map(a => (
                  <div key={a.id} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(91,33,182,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#5b21b6' }}>
                        {a.first_name[0]}{a.last_name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>{a.first_name} {a.last_name}</div>
                        <div style={{ fontSize: 11, color: '#7c3aed' }}>{a.years} year{a.years > 1 ? 's' : ''} since approval · {a.visa_type || 'Immigration Case'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/clients/${a.id}`} style={{ fontSize: 11, fontWeight: 600, color: '#5b21b6', background: 'rgba(91,33,182,0.1)', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={11} /> View Profile
                      </Link>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, fontWeight: 600, color: '#5b21b6', background: 'rgba(139,92,246,0.15)', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => window.open(`mailto:${a.email || ''}?subject=Congratulations on your ${a.years}-year Anniversary!&body=Dear ${a.first_name},%0D%0A%0D%0ACongratulations on your ${a.years}-year immigration approval anniversary! 🏆%0D%0A%0D%0ABest regards`, '_blank')}>
                        <Award size={11} /> Send Congratulations
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Critical Deadlines Card */}
            {todayData.deadlines.length > 0 && (
              <div className="card" style={{ background: 'linear-gradient(135deg, #fff5f5, #fee2e2)', border: '1px solid #fecaca', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={16} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#991b1b' }}>⚠️ Critical Deadlines</div>
                      <div style={{ fontSize: 11, color: '#dc2626' }}>{todayData.deadlines.length} deadline{todayData.deadlines.length > 1 ? 's' : ''} this week</div>
                    </div>
                  </div>
                </div>
                {todayData.deadlines.map(dl => {
                  const days = getDaysUntil(dl.deadline_date);
                  return (
                    <div key={dl.id} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 4, height: 36, borderRadius: 2, background: getUrgencyColor(days), flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>{dl.title}</div>
                          <div style={{ fontSize: 11, color: '#dc2626' }}>
                            {dl.first_name} {dl.last_name} · {new Date(dl.deadline_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                          color: getUrgencyColor(days),
                          background: `${getUrgencyColor(days)}18`,
                        }}>
                          {days < 0 ? `${Math.abs(days)}d OVERDUE` : days === 0 ? 'TODAY' : `${days}d left`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/clients/${dl.client_id}`} style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FileText size={11} /> Open Case
                        </Link>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', background: 'rgba(239,68,68,0.08)', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => window.open(`mailto:?subject=Deadline Reminder: ${dl.title}&body=Dear ${dl.first_name},%0D%0A%0D%0AThis is a reminder about the upcoming deadline: ${dl.title}%0D%0ADeadline Date: ${new Date(dl.deadline_date).toLocaleDateString()}%0D%0A%0D%0APlease ensure all required documents are submitted on time.%0D%0A%0D%0ABest regards`, '_blank')}>
                          <Calendar size={11} /> Notify Client
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workspace Cards */}
      <div style={{ marginTop: 20 }}>
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
