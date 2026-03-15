import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Bell, AlertTriangle, Cake, Award, CheckSquare, X, Check, Clock } from 'lucide-react';

const TYPE_META = {
  deadline_reminder: { icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2', label: 'Deadline' },
  birthday:          { icon: Cake,          color: '#f59e0b', bg: '#fffbeb', label: 'Birthday' },
  anniversary:       { icon: Award,         color: '#8b5cf6', bg: '#f5f3ff', label: 'Anniversary' },
  task_due:          { icon: CheckSquare,   color: '#3b82f6', bg: '#eff6ff', label: 'Task' },
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [count, setCount] = useState(0);
  const ref = useRef(null);

  const fetchCount = () => {
    api.getNotificationCount().then(r => setCount(r.count)).catch(() => {});
  };

  const fetchAll = () => {
    api.getNotifications().then(setNotifications).catch(() => {});
  };

  useEffect(() => {
    // Generate notifications on mount, then fetch
    api.generateNotifications().catch(() => {}).finally(() => {
      fetchCount();
    });
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) fetchAll();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = async (id) => {
    await api.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setCount(0);
  };

  const dismiss = async (id) => {
    await api.dismissNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    fetchCount();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
          padding: '8px', borderRadius: 8, display: 'flex', alignItems: 'center',
        }}
      >
        <Bell size={18} color={count > 0 ? '#f59e0b' : 'var(--text-muted)'} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, width: 18, height: 18,
            borderRadius: '50%', background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--topnav-bg, #1e3a2f)',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 380, maxHeight: 460, background: '#fff', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
          zIndex: 100, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Notifications</div>
            {notifications.some(n => !n.is_read) && (
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Bell size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>No notifications</div>
              </div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.task_due;
                const Icon = meta.icon;
                return (
                  <div key={n.id} style={{
                    padding: '12px 18px', borderBottom: '1px solid var(--border-light)',
                    display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(59,130,246,0.04)',
                    transition: 'background 0.15s',
                  }}
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={meta.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {n.title}
                      </div>
                      {n.message && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                          {n.message}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: meta.bg, color: meta.color,
                        }}>
                          {meta.label}
                        </span>
                        {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.4 }}>
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
