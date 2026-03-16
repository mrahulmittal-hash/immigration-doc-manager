import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, CheckSquare, Calendar, CreditCard,
  Newspaper, UserCog, Mail, LogOut, ChevronDown, Settings, Briefcase, FileText
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import ClientList from './pages/ClientList';
import CreateClient from './pages/CreateClient';
import ClientDetail from './pages/ClientDetail';
import Tasks from './pages/Tasks';
import CalendarPage from './pages/CalendarPage';
import TrustAccounting from './pages/TrustAccounting';
import PIFForm from './pages/PIFForm';
import SignPage from './pages/SignPage';
import ClientPortal from './pages/ClientPortal';
import UsersPage from './pages/UsersPage';
import ImmigrationUpdates from './pages/ImmigrationUpdates';
import EmailSettings from './pages/EmailSettings';
import Employers from './pages/Employers';
import EmployerDetail from './pages/EmployerDetail';
import LMIADashboard from './pages/LMIADashboard';
import IRCCTemplates from './pages/IRCCTemplates';
import LoginPage from './pages/LoginPage';
import SessionWrapper from './components/SessionWrapper';
import NotificationPanel from './components/NotificationPanel';
import './index.css';

const NAV_ITEMS = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/clients',      icon: Users,           label: 'Clients' },
  { to: '/pipeline',     icon: GitBranch,       label: 'Pipeline' },
  { to: '/tasks',        icon: CheckSquare,     label: 'Tasks' },
  { to: '/calendar',     icon: Calendar,        label: 'Calendar' },
];

const MORE_ITEMS = [
  { to: '/retainers',       icon: CreditCard,  label: 'Trust Accounting' },
  { to: '/ircc-templates',  icon: FileText,    label: 'IRCC Forms' },
  { to: '/ircc-updates',    icon: Newspaper,   label: 'IRCC Updates' },
  { to: '/users',           icon: UserCog,     label: 'Users' },
  { to: '/settings/email',  icon: Mail,        label: 'Email Settings' },
];

function TopNav({ user, onLogout }) {
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'DU';

  // Close more menu on route change
  useEffect(() => { setShowMore(false); }, [location.pathname]);

  return (
    <nav className="topnav">
      <NavLink to="/" className="topnav-brand">
        <div className="topnav-logo">P</div>
        <span className="topnav-title">PropAgent</span>
        <span className="topnav-badge">RCIC CRM</span>
      </NavLink>

      <div className="topnav-links">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}
          >
            <item.icon size={16} /> {item.label}
          </NavLink>
        ))}

        {/* More Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className={`topnav-link ${MORE_ITEMS.some(m => location.pathname.startsWith(m.to)) ? 'active' : ''}`}
            onClick={() => setShowMore(!showMore)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <Settings size={16} /> More <ChevronDown size={14} />
          </button>
          {showMore && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMore(false)} />
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                background: '#fff', borderRadius: 12, padding: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
                minWidth: 200, zIndex: 50,
              }}>
                {MORE_ITEMS.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}
                    style={{ color: 'var(--text-secondary)', borderRadius: 8, padding: '10px 14px' }}
                    onClick={() => setShowMore(false)}
                  >
                    <item.icon size={16} /> {item.label}
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="topnav-right">
        <NotificationPanel />
        <div className="topnav-user">
          <div className="topnav-user-avatar">{initials}</div>
          <div>
            <div className="topnav-user-name">{user?.name || 'Demo User'}</div>
            <div className="topnav-user-email">{user?.email || 'demo@propagent.ca'}</div>
          </div>
        </div>
        <button className="topnav-logout" onClick={onLogout}>
          <LogOut size={14} />
        </button>
      </div>
    </nav>
  );
}

function AdminShell({ children, user, onLogout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav user={user} onLogout={onLogout} />
      <div className="page-content page-enter">
        {children}
      </div>
    </div>
  );
}

function getStoredUser() {
  try {
    const stored = localStorage.getItem('crm_user');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export default function App() {
  const [user, setUser] = useState(getStoredUser);

  const handleLogout = () => {
    setUser(null);
  };

  const ProtectedLayout = () => (
    user ? (
      <SessionWrapper user={user} onLogout={handleLogout}>
        <AdminShell user={user} onLogout={handleLogout}>
          <Outlet />
        </AdminShell>
      </SessionWrapper>
    ) : (
      <Navigate to="/login" />
    )
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          user ? <Navigate to="/" /> : <LoginPage onLogin={setUser} />
        } />
        <Route path="/pif/:token" element={<PIFForm />} />
        <Route path="/sign/:token" element={<SignPage />} />
        <Route path="/portal/:token/*" element={<ClientPortal />} />

        {/* Protected Admin routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/clients" element={<ClientList />} />
          <Route path="/clients/new" element={<CreateClient />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/retainers" element={<TrustAccounting />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/ircc-updates" element={<ImmigrationUpdates />} />
          <Route path="/settings/email" element={<EmailSettings />} />
          <Route path="/employers" element={<Employers />} />
          <Route path="/employers/:id" element={<EmployerDetail />} />
          <Route path="/lmia" element={<LMIADashboard />} />
          <Route path="/ircc-templates" element={<IRCCTemplates />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
