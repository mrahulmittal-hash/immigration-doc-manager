import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  {
    section: 'Overview',
    links: [
      { to: '/', icon: '⬛', label: 'Dashboard', end: true },
    ]
  },
  {
    section: 'CRM',
    links: [
      { to: '/pipeline', icon: '📊', label: 'Pipeline' },
      { to: '/clients',  icon: '👥', label: 'Clients' },
      { to: '/tasks',    icon: '✅', label: 'Tasks' },
      { to: '/calendar', icon: '📅', label: 'Calendar' },
    ]
  },
  {
    section: 'Finance',
    links: [
      { to: '/retainers', icon: '💳', label: 'Retainers' },
    ]
  },
  {
    section: 'Documents',
    links: [
      { to: '/clients', icon: '📁', label: 'All Documents' },
      { to: '/clients', icon: '📝', label: 'Forms & Filling' },
    ]
  },
  {
    section: 'Settings',
    links: [
      { to: '/users', icon: '👤', label: 'User Management' },
    ]
  },
];

export default function Sidebar({ user }) {
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'SK';
  
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">🏛️</div>
        <div>
          <div className="brand-name">PropAgent</div>
          <div className="brand-tagline">Immigration & Visa CRM</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(sec => (
          <div key={sec.section}>
            <div className="nav-section-label">{sec.section}</div>
            {sec.links.map(link => (
              <NavLink
                key={link.label}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{link.icon}</span>
                {link.label}
                {link.badge && <span className="nav-badge">{link.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name || 'Sarah Kim'}</div>
          <div className="sidebar-user-role">{user?.role || 'Case Manager'}</div>
        </div>
        <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:4 }}>⚙️</button>
      </div>
    </aside>
  );
}
