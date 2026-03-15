import { useState } from 'react';

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const EVENT_COLORS = { consultation:'consultation', deadline:'deadline', reminder:'reminder' };

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

  function prev() {
    setCur(c => c.m === 0 ? { y: c.y-1, m:11 } : { y:c.y, m:c.m-1 });
  }
  function next() {
    setCur(c => c.m === 11 ? { y: c.y+1, m:0 } : { y:c.y, m:c.m+1 });
  }

  const dim  = daysInMonth(cur.y, cur.m);
  const fd   = firstDay(cur.y, cur.m);
  const cells = [];
  // blanks
  for (let i=0; i < fd; i++) cells.push(null);
  for (let d=1; d <= dim; d++) cells.push(d);

  function isoDate(d) {
    return `${cur.y}-${String(cur.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function eventsFor(d) {
    return events.filter(e => e.date === isoDate(d));
  }
  function isToday(d) {
    return cur.y === now.getFullYear() && cur.m === now.getMonth() && d === now.getDate();
  }

  function addEvent() {
    if (!newEv.date || !newEv.label) return;
    setEvents(ev => [...ev, { ...newEv }]);
    setNewEv({ date:'', label:'', type:'consultation' });
    setShowNew(false);
  }

  const todayEvents = events.filter(e => e.date === isoDate(now.getDate())).concat(
    events.filter(e => e.date > isoDate(now.getDate())).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4)
  );

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Calendar</div>
          <div className="page-subtitle">Consultations, deadlines & reminders</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Add Event</button>
      </div>

      <div className="grid-2" style={{ gap:24, alignItems:'flex-start' }}>
        {/* Calendar grid */}
        <div className="card" style={{ padding:0, overflow:'hidden', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            <button className="btn btn-ghost btn-sm" onClick={prev} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: 32, height: 32, padding: 0, borderRadius: 8 }}>←</button>
            <div style={{ fontWeight:800, fontSize:16, letterSpacing: '-0.02em' }}>{MONTHS[cur.m]} {cur.y}</div>
            <button className="btn btn-ghost btn-sm" onClick={next} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: 32, height: 32, padding: 0, borderRadius: 8 }}>→</button>
          </div>
          <div className="cal-grid" style={{ border: 'none', borderRadius: 0 }}>
            {DAYS.map(d => <div key={d} className="cal-header-cell">{d}</div>)}
            {cells.map((day, i) => (
              <div key={i} className={`cal-day${day && isToday(day) ? ' today' : ''}${!day ? ' other-month' : ''}`}
                   onClick={() => day && setSelected(isoDate(day))}>
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

        {/* Upcoming Events */}
        <div className="card" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
          <div className="card-header" style={{ marginBottom: 24 }}>
            <div>
              <div className="card-title">Upcoming Events</div>
              <div className="card-subtitle">Next scheduled items pipeline</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:12, marginBottom:20 }}>
            {[['consultation','Consultation','#60a5fa'],['deadline','Deadline','#f87171'],['reminder','Reminder','#fbbf24']].map(([t,l,c]) => (
              <div key={t} className="flex-center gap-8" style={{ fontSize:12, color:c, fontWeight:600, background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 20 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:c, boxShadow: `0 0 6px ${c}` }} />
                {l}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.sort((a,b)=>a.date.localeCompare(b.date)).map((ev, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width:48, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign:'center', flexShrink: 0 }}>
                  <div style={{ fontSize:14, color:'var(--text-primary)', fontWeight:800, lineHeight: 1 }}>
                    {ev.date.split('-')[2]}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>
                    {MONTHS[parseInt(ev.date.split('-')[1])-1].slice(0,3)}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color: 'var(--text-primary)', marginBottom: 4 }}>{ev.label}</div>
                  <div style={{ fontSize:11 }}>
                    <span className={`cal-event ${ev.type}`} style={{ display:'inline-flex', padding:'2px 8px', borderRadius:4, border: 'none' }}>
                      {ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}
                    </span>
                  </div>
                </div>
                <button style={{ background:'rgba(239, 68, 68, 0.1)', border:'none', color:'#ef4444', cursor:'pointer', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
                  onClick={() => setEvents(prev => prev.filter(e => e !== ev))}>×</button>
              </div>
            ))}
            {events.length === 0 && (
              <div className="empty" style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <div className="empty-icon">📅</div>
                <div className="empty-title">No events</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Event Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Calendar Event</div>
              <button className="modal-close" onClick={() => setShowNew(false)}>×</button>
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
