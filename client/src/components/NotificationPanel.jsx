import { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)',
          padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center',
          transition: 'all 0.15s',
        }}
      >
        <Bell size={18} />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            background: '#fff', borderRadius: 12, padding: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
            width: 300, zIndex: 50,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No new notifications
            </div>
          </div>
        </>
      )}
    </div>
  );
}
