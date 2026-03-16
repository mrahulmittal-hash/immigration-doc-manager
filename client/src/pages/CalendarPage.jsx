import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X, Plus, Clock, AlertTriangle, Bell } from 'lucide-react';

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const EVENT_TYPE_CONFIG = {
  consultation: { color: '#60a5fa', label: 'Consultation', bg: 'rgba(96,165,250,.1)' },
  deadline:     { color: '#f87171', label: 'Deadline',     bg: 'rgba(248,113,113,.1)' },
  reminder:     { color: '#fbbf24', label: 'Reminder',     bg: 'rgba(251,191,36,.1)' },
};

const SAMPLE_EVENTS = [
  { date:'2026-03-16', label:'Consultation — Wei Chen',     type:'consultation' },
  { date:'2026-03-18', label:'IRCC Deadline — Patel EE',   type:'deadline' },
  { date:'2026-03-20', label:'Follow-up call — Garcia',    type:'reminder' },
  { date:'2026-03-22', label:'Document review session',    type:'consultation' },
  { date:'2026-03-25', label:'Retainer due — Nguyen',      type:'deadline' },
];

function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function firstDay(y, m)    { return new Date(y, m, 1).getDay(); }

export default function CalendarPage() {
  const now  = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [events, setEvents] = useState(SAMPLE_EVENTS);
  const [showNew, setShowNew] = useState(false);
  const [newEv, setNewEv] = useState({ date:'', label:'', type:'consultation' });
  const [selected, setSelected] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');

  function prev() { setCur(c => c.m === 0 ? { y: c.y-1, m:11 } : { y:c.y, m:c.m-1 }); }
  function next() { setCur(c => c.m === 11 ? { y: c.y+1, m:0 } : { y:c.y, m:c.m+1 }); }

  const dim  = daysInMonth(cur.y, cur.m);
  const fd   = firstDay(cur.y, cur.m);
  const cells = [];
  for (let i=0; i < fd; i++) cells.push(null);
  for (let d=1; d <= dim; d++) cells.push(d);

  function isoDate(d) { return `${cur.y}-${String(cur.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  function eventsFor(d) { return events.filter(e => e.date === isoDate(d)); }
  function isToday(d) { return cur.y === now.getFullYear() && cur.m === now.getMonth() && d === now.getDate(); }

  function addEvent() {
    if (!newEv.date || !newEv.label) return;
    setEvents(ev => [...ev, { ...newEv }]);
    setNewEv({ date:'', label:'', type:'consultation' });
    setShowNew(false);
  }

  const sortedEvents = [...events].sort((a,b) => a.date.localeCompare(b.date));
  const filteredEvents = typeFilter ? sortedEvents.filter(e => e.type === typeFilter) : sortedEvents;
  const selectedEvents = selected ? events.filter(e => e.date === selected) : [];

  const consultations = events.filter(e => e.type === 'consultation').length;
  const deadlines = events.filter(e => e.type === 'deadline').length;
  const reminders = events.filter(e => e.type === 'reminder').length;

  return (
    <div className="clients-3panel">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        <button className="clients-add-btn" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Add Event
        </button>

        {/* Event type filter */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px', marginBottom: 8, flexWrap: 'wrap' }}>
          <button className={`clients-filter-chip ${!typeFilter ? 'active' : ''}`} onClick={() => setTypeFilter('')}>All</button>
          {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
            <button key={key} className={`clients-filter-chip ${typeFilter === key ? 'active' : ''}`}
              onClick={() => setTypeFilter(key)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Upcoming events list */}
        <div className="clients-list">
          {filteredEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No events</div>
          ) : filteredEvents.map((ev, i) => {
            const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.consultation;
            return (
              <div key={i}
                className={`clients-list-item ${selected === ev.date ? 'active' : ''}`}
                onClick={() => setSelected(ev.date)}
              >
                <div className="clients-item-avatar" style={{
                  background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}30`,
                  flexDirection: 'column', gap: 0, fontSize: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{ev.date.split('-')[2]}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>
                    {MONTHS[parseInt(ev.date.split('-')[1])-1].slice(0,3)}
                  </div>
                </div>
                <div className="clients-item-info">
                  <div className="clients-item-name">{ev.label}</div>
                  <div className="clients-item-meta">{cfg.label}</div>
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

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {/* Calendar Grid */}
          <div className="clients-detail-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border-light)', background: 'var(--bg-base)' }}>
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
              {cells.map((day, i) => (
                <div key={i}
                  className={`cal-day${day && isToday(day) ? ' today' : ''}${!day ? ' other-month' : ''}${day && isoDate(day) === selected ? ' active' : ''}`}
                  onClick={() => day && setSelected(isoDate(day))}
                  style={day && isoDate(day) === selected ? { background: 'rgba(13,148,136,.06)', border: '1px solid rgba(13,148,136,.2)' } : {}}
                >
                  {day && <div className="cal-day-num">{day}</div>}
                  {day && eventsFor(day).map((ev, ei) => (
                    <div key={ei} className={`cal-event ${ev.type}`}>
                      {ev.label.split(' — ')[0]}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Selected date events */}
          {selected && selectedEvents.length > 0 && (
            <div className="clients-detail-card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)' }}>
                Events for {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedEvents.map((ev, i) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.type];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{ev.label}</div>
                        <div style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
                      </div>
                      <button style={{ background: 'rgba(239,68,68,.1)', border: 'none', color: '#ef4444', cursor: 'pointer', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => setEvents(prev => prev.filter(e => e !== ev))}><X size={14} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        {/* Event Counts */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Event Summary</div>
          <div className="clients-ctx-stat-row">
            <span>Total Events</span>
            <strong>{events.length}</strong>
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
            <strong style={{ color: '#f87171' }}>{deadlines}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} /> Reminders
            </span>
            <strong style={{ color: '#fbbf24' }}>{reminders}</strong>
          </div>
        </div>

        {/* Selected Date */}
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
                  const cfg = EVENT_TYPE_CONFIG[ev.type];
                  return (
                    <div key={i} className="clients-ctx-row">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                      <span style={{ fontSize: 12 }}>{ev.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Upcoming This Week */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Upcoming</div>
          {sortedEvents.filter(e => e.date >= now.toISOString().slice(0, 10)).slice(0, 5).map((ev, i) => {
            const cfg = EVENT_TYPE_CONFIG[ev.type];
            return (
              <div key={i} className="clients-ctx-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(ev.date)}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
          {sortedEvents.filter(e => e.date >= now.toISOString().slice(0, 10)).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No upcoming events</div>
          )}
        </div>
      </div>

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
