import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Plus, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../api';

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const EVENT_TYPE_CONFIG = {
  consultation: { color: '#60a5fa', label: 'Consultation', bg: 'rgba(96,165,250,.1)' },
  deadline:     { color: '#f87171', label: 'Deadline',     bg: 'rgba(248,113,113,.1)' },
  reminder:     { color: '#fbbf24', label: 'Reminder',     bg: 'rgba(251,191,36,.1)' },
  completed:    { color: '#4ade80', label: 'Completed',    bg: 'rgba(74,222,128,.1)' },
};

function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function firstDay(y, m)    { return new Date(y, m, 1).getDay(); }

export default function CalendarPage() {
  const navigate = useNavigate();
  const now  = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newEv, setNewEv] = useState({ date:'', label:'', type:'consultation' });
  const [selected, setSelected] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Tooltip state
  const [tooltip, setTooltip] = useState(null);
  const tooltipRef = useRef(null);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    try {
      setLoading(true);
      const data = await api.getCalendarEvents();
      setEvents(data);
    } catch (err) {
      console.error('Error loading calendar events:', err);
    } finally {
      setLoading(false);
    }
  }

  function prev() { setCur(c => c.m === 0 ? { y: c.y-1, m:11 } : { y:c.y, m:c.m-1 }); }
  function next() { setCur(c => c.m === 11 ? { y: c.y+1, m:0 } : { y:c.y, m:c.m+1 }); }

  const dim  = daysInMonth(cur.y, cur.m);
  const fd   = firstDay(cur.y, cur.m);
  const cells = [];
  for (let i=0; i < fd; i++) cells.push(null);
  for (let d=1; d <= dim; d++) cells.push(d);

  function isoDate(d) { return `${cur.y}-${String(cur.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  function eventsFor(d) { return activeEvents.filter(e => e.date === isoDate(d)); }
  function isToday(d) { return cur.y === now.getFullYear() && cur.m === now.getMonth() && d === now.getDate(); }

  // Navigate to client profile when clicking an event
  function handleEventClick(ev, e) {
    e.stopPropagation();
    if (ev.clientId) {
      navigate(`/clients/${ev.clientId}`);
    }
  }

  // Tooltip handlers
  const showTooltip = useCallback((ev, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      ev,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  async function addEvent() {
    if (!newEv.date || !newEv.label) return;
    try {
      await api.createTask({
        title: newEv.label,
        due_date: newEv.date,
        priority: newEv.type === 'deadline' ? 'high' : 'medium',
        category: newEv.type === 'consultation' ? 'Other' : 'Client Follow-up',
      });
      setNewEv({ date:'', label:'', type:'consultation' });
      setShowNew(false);
      loadEvents();
    } catch (err) {
      console.error('Error adding event:', err);
    }
  }

  const activeEvents = showCompleted ? events : events.filter(e => !e.done);
  const sortedEvents = [...activeEvents].sort((a,b) => a.date.localeCompare(b.date));
  const filteredEvents = typeFilter ? sortedEvents.filter(e => e.type === typeFilter) : sortedEvents;
  const selectedEvents = selected ? activeEvents.filter(e => e.date === selected) : [];

  const consultations = activeEvents.filter(e => e.type === 'consultation').length;
  const deadlineCount = activeEvents.filter(e => e.type === 'deadline').length;
  const reminderCount = activeEvents.filter(e => e.type === 'reminder').length;
  const completedCount = events.filter(e => e.done).length;

  // How many events to show per cell (fixed height cells)
  const MAX_VISIBLE = 2;

  return (
    <div className="clients-3panel">
      {/* LEFT SIDEBAR */}
      <div className="clients-sidebar">
        <button className="clients-add-btn" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Add Event
        </button>

        <div style={{ display: 'flex', gap: 6, padding: '0 12px', marginBottom: 8, flexWrap: 'wrap' }}>
          <button className={`clients-filter-chip ${!typeFilter ? 'active' : ''}`} onClick={() => setTypeFilter('')}>All</button>
          {Object.entries(EVENT_TYPE_CONFIG).filter(([key]) => key !== 'completed').map(([key, cfg]) => (
            <button key={key} className={`clients-filter-chip ${typeFilter === key ? 'active' : ''}`}
              onClick={() => setTypeFilter(key)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
              {cfg.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '4px 12px', marginBottom: 8 }}>
          <button
            className={`clients-filter-chip ${showCompleted ? 'active' : ''}`}
            onClick={() => setShowCompleted(!showCompleted)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
          >
            <CheckCircle size={12} /> {showCompleted ? 'Hide' : 'Show'} Completed ({completedCount})
          </button>
        </div>

        <div className="clients-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ marginTop: 8 }}>Loading events...</div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No events</div>
          ) : filteredEvents.map((ev, i) => {
            const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.reminder;
            return (
              <div key={ev.id || i}
                className={`clients-list-item ${selected === ev.date ? 'active' : ''}`}
                onClick={() => ev.clientId ? navigate(`/clients/${ev.clientId}`) : setSelected(ev.date)}
                style={{ ...( ev.done ? { opacity: 0.5 } : {}), cursor: 'pointer' }}
              >
                <div className="clients-item-avatar" style={{
                  background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}30`,
                  flexDirection: 'column', gap: 0, fontSize: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{ev.date.split('-')[2]}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>
                    {MONTHS[parseInt(ev.date.split('-')[1])-1]?.slice(0,3)}
                  </div>
                </div>
                <div className="clients-item-info">
                  <div className="clients-item-name" style={ev.done ? { textDecoration: 'line-through' } : {}}>
                    {ev.label}
                  </div>
                  <div className="clients-item-meta">
                    {ev.client && <span style={{ fontWeight: 600 }}>{ev.client} &middot; </span>}
                    <span style={{ color: cfg.color }}>{ev.source === 'task' ? 'Task' : 'Deadline'}</span>
                  </div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* CENTER PANEL */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          <div className="clients-detail-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--border-light)', background: 'var(--bg-base)' }}>
              <button className="btn btn-ghost btn-sm" onClick={prev} style={{ background: 'var(--bg-elevated)', border: 'none', width: 32, height: 32, padding: 0, borderRadius: 8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ChevronLeft size={16} />
              </button>
              <div style={{ fontWeight:800, fontSize:16, letterSpacing: '-0.02em' }}>{MONTHS[cur.m]} {cur.y}</div>
              <button className="btn btn-ghost btn-sm" onClick={next} style={{ background: 'var(--bg-elevated)', border: 'none', width: 32, height: 32, padding: 0, borderRadius: 8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="cal-grid" style={{ border: 'none', borderRadius: 0 }}>
              {DAYS.map(d => <div key={d} className="cal-header-cell">{d}</div>)}
              {cells.map((day, i) => {
                const dayEvents = day ? eventsFor(day) : [];
                return (
                  <div key={i}
                    className={`cal-day${day && isToday(day) ? ' today' : ''}${!day ? ' other-month' : ''}${day && isoDate(day) === selected ? ' active' : ''}`}
                    onClick={() => day && setSelected(isoDate(day))}
                    style={day && isoDate(day) === selected ? { background: 'rgba(13,148,136,.06)', border: '1px solid rgba(13,148,136,.2)' } : {}}
                  >
                    {day && (
                      <>
                        <div className="cal-day-num">{day}</div>
                        {dayEvents.slice(0, MAX_VISIBLE).map((ev, ei) => {
                          const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.reminder;
                          const shortClient = ev.client ? ev.client.split(' ')[0] : '';
                          return (
                            <div
                              key={ei}
                              className={`cal-event ${ev.type}`}
                              style={ev.done ? { opacity: 0.4, textDecoration: 'line-through' } : {}}
                              onClick={(e) => handleEventClick(ev, e)}
                              onMouseEnter={(e) => showTooltip(ev, e)}
                              onMouseLeave={hideTooltip}
                            >
                              {shortClient ? `${shortClient}: ` : ''}{ev.label.length > 22 ? ev.label.slice(0, 20) + '…' : ev.label}
                            </div>
                          );
                        })}
                        {dayEvents.length > MAX_VISIBLE && (
                          <div
                            className="cal-day-more"
                            onClick={(e) => { e.stopPropagation(); setSelected(isoDate(day)); }}
                          >
                            +{dayEvents.length - MAX_VISIBLE} more
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected date detail card */}
          {selected && selectedEvents.length > 0 && (
            <div className="clients-detail-card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)' }}>
                Events for {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedEvents.map((ev, i) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.reminder;
                  return (
                    <div
                      key={ev.id || i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                        background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-light)',
                        opacity: ev.done ? 0.5 : 1, cursor: ev.clientId ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                      }}
                      onClick={() => ev.clientId && navigate(`/clients/${ev.clientId}`)}
                      onMouseEnter={(e) => { if (ev.clientId) e.currentTarget.style.borderColor = cfg.color; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 6px ${cfg.color}`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, textDecoration: ev.done ? 'line-through' : 'none' }}>{ev.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {ev.client && <span style={{ fontWeight: 600, color: '#0d9488' }}>{ev.client}</span>}
                          {ev.client && ' \u00b7 '}
                          <span style={{ color: cfg.color, fontWeight: 600 }}>{ev.source === 'task' ? 'Task' : 'Deadline'}</span>
                          {ev.category && <span> \u00b7 {ev.category}</span>}
                        </div>
                      </div>
                      {ev.source === 'task' && !ev.done && (
                        <button
                          style={{ background: 'rgba(74,222,128,.1)', border: 'none', color: '#4ade80', cursor: 'pointer', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Mark as done"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await api.toggleTask(ev.sourceId);
                              loadEvents();
                            } catch (err) { console.error(err); }
                          }}
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {ev.clientId && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>View →</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT CONTEXT PANEL */}
      <div className="clients-context">
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Event Summary</div>
          <div className="clients-ctx-stat-row">
            <span>Total Active</span>
            <strong>{activeEvents.length}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa' }} /> Consultations
            </span>
            <strong style={{ color: '#60a5fa' }}>{consultations}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} /> Deadlines
            </span>
            <strong style={{ color: '#f87171' }}>{deadlineCount}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} /> Reminders
            </span>
            <strong style={{ color: '#fbbf24' }}>{reminderCount}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} /> Completed
            </span>
            <strong style={{ color: '#4ade80' }}>{completedCount}</strong>
          </div>
        </div>

        {selected && (
          <div className="clients-ctx-section">
            <div className="clients-ctx-label">Selected Date</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No events on this date</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedEvents.map((ev, i) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.reminder;
                  return (
                    <div key={ev.id || i} className="clients-ctx-row"
                      style={{ cursor: ev.clientId ? 'pointer' : 'default' }}
                      onClick={() => ev.clientId && navigate(`/clients/${ev.clientId}`)}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{ev.label}</span>
                        {ev.client && <div style={{ fontSize: 10, color: '#0d9488', fontWeight: 600 }}>{ev.client}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Upcoming</div>
          {sortedEvents.filter(e => e.date >= now.toISOString().slice(0, 10) && !e.done).slice(0, 8).map((ev, i) => {
            const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.reminder;
            return (
              <div key={ev.id || i} className="clients-ctx-row" style={{ cursor: 'pointer' }} onClick={() => {
                if (ev.clientId) { navigate(`/clients/${ev.clientId}`); return; }
                setSelected(ev.date);
                const [y, m] = ev.date.split('-').map(Number);
                if (y !== cur.y || m-1 !== cur.m) setCur({ y, m: m-1 });
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {ev.client && <span style={{ color: '#0d9488', fontWeight: 600 }}>{` \u2014 ${ev.client}`}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {sortedEvents.filter(e => e.date >= now.toISOString().slice(0, 10) && !e.done).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No upcoming events</div>
          )}
        </div>

        {sortedEvents.filter(e => e.date < now.toISOString().slice(0, 10) && !e.done).length > 0 && (
          <div className="clients-ctx-section">
            <div className="clients-ctx-label" style={{ color: '#f87171', display: 'flex', alignItems: 'center' }}>
              <AlertTriangle size={12} style={{ marginRight: 4 }} /> Overdue
            </div>
            {sortedEvents.filter(e => e.date < now.toISOString().slice(0, 10) && !e.done).map((ev, i) => (
              <div key={ev.id || i} className="clients-ctx-row" style={{ cursor: 'pointer' }} onClick={() => {
                if (ev.clientId) { navigate(`/clients/${ev.clientId}`); return; }
                setSelected(ev.date);
                const [y, m] = ev.date.split('-').map(Number);
                if (y !== cur.y || m-1 !== cur.m) setCur({ y, m: m-1 });
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f87171' }}>{ev.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {ev.client && <span style={{ color: '#0d9488', fontWeight: 600 }}>{` \u2014 ${ev.client}`}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          className="cal-tooltip"
          style={{
            display: 'block',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="tt-title">{tooltip.ev.label}</div>
          {tooltip.ev.client && <div className="tt-client">{tooltip.ev.client}</div>}
          <div className="tt-meta">
            {tooltip.ev.source === 'task' ? 'Task' : 'Deadline'}
            {tooltip.ev.category && ` \u00b7 ${tooltip.ev.category}`}
            {tooltip.ev.clientId && ' \u00b7 Click to view client'}
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Calendar Event</div>
              <button className="modal-close" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label className="form-label">Event Title</label>
                <input className="form-input" placeholder="e.g. Consultation — Client Name"
                  value={newEv.label} onChange={e => setNewEv({...newEv, label:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={newEv.date} onChange={e => setNewEv({...newEv, date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={newEv.type} onChange={e => setNewEv({...newEv, type:e.target.value})}>
                  <option value="consultation">Consultation</option>
                  <option value="deadline">Deadline</option>
                  <option value="reminder">Reminder</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addEvent}>Add Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
