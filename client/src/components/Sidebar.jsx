import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitBranch, Users, CheckSquare, Calendar, CreditCard, FolderOpen, FileText, UserCog, Settings, ChevronLeft, ChevronRight, Newspaper, Mail } from 'lucide-react';

const navItems = [
  {
    section: 'Overview',
    links: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ]
  },
  {
    section: 'CRM',
    links: [
      { to: '/pipeline', icon: GitBranch, label: 'Pipeline' },
      { to: '/clients',  icon: Users, label: 'Clients' },
      { to: '/tasks',    icon: CheckSquare, label: 'Tasks' },
      { to: '/calendar', icon: Calendar, label: 'Calendar' },
    ]
  },
  {
    section: 'Finance',
    links: [
      { to: '/retainers', icon: CreditCard, label: 'Retainers' },
    ]
  },
  {
    section: 'Immigration',
    links: [
      { to: '/ircc-updates', icon: Newspaper, label: 'IRCC Updates' },
    ]
  },
  {
    section: 'Documents',
    links: [
      { to: '/clients', icon: FolderOpen, label: 'All Documents' },
      { to: '/clients', icon: FileText, label: 'Forms & Filling' },
    ]
  },
  {
    section: 'Settings',
    links: [
      { to: '/users', icon: UserCog, label: 'User Management' },
      { to: '/settings/email', icon: Mail, label: 'Email Integration' },
    ]
  },
];

export default function Sidebar({ user }) {
  const [collapsed, setCollapsed] = useState(false);
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'SK';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-logo">P</div>
        {!collapsed && (
          <div>
            <div className="brand-name">PropAgent</div>
            <div className="brand-tagline">Immigration & Visa CRM</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {navItems.map(sec => (
          <div key={sec.section}>
            {!collapsed && <div className="nav-section-label">{sec.section}</div>}
            {collapsed && <div className="nav-divider" />}
            {sec.links.map(link => (
              <NavLink
                key={link.label}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                title={collapsed ? link.label : undefined}
              >
                <span className="nav-icon"><link.icon size={18} /></span>
                {!collapsed && <span>{link.label}</span>}
                {!collapsed && link.badge && <span className="nav-badge">{link.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="sidebar-footer">
        <div className="sidebar-user-avatar">{initials}</div>
        {!collapsed && (
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'Sarah Kim'}</div>
            <div className="sidebar-user-role">{user?.role || 'Case Manager'}</div>
          </div>
        )}
        {!collapsed && (
          <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:4, display:'flex' }}>
            <Settings size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
