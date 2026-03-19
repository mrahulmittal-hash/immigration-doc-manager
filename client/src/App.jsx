import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, CheckSquare, Calendar, CreditCard,
  Newspaper, UserCog, LogOut, ChevronDown, Settings, Briefcase, Menu, X
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { canAccessRoute } from './constants/roles';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import ClientList from './pages/ClientList';
import CreateClient from './pages/CreateClient';
import Tasks from './pages/Tasks';
import CalendarPage from './pages/CalendarPage';
import TrustAccounting from './pages/TrustAccounting';
import PIFForm from './pages/PIFForm';
import SignPage from './pages/SignPage';
import ClientPortal from './pages/ClientPortal';
import UsersPage from './pages/UsersPage';
import ImmigrationUpdates from './pages/ImmigrationUpdates';
import IRCCTemplates from './pages/IRCCTemplates';
import AdminSettings from './pages/AdminSettings';
import LoginPage from './pages/LoginPage';
import SessionWrapper from './components/SessionWrapper';
import NotificationPanel from './components/NotificationPanel';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

const NAV_ITEMS = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/clients',      icon: Users,           label: 'Clients' },
  { to: '/pipeline',     icon: GitBranch,       label: 'Pipeline' },
  { to: '/tasks',        icon: CheckSquare,     label: 'Tasks' },
  { to: '/calendar',     icon: Calendar,        label: 'Calendar' },
];

const MORE_ITEMS = [
  { to: '/retainers',    icon: CreditCard,  label: 'Accounting' },
  { to: '/ircc-updates', icon: Newspaper,   label: 'IRCC Updates' },
  { to: '/users',        icon: UserCog,     label: 'Users' },
  { to: '/admin',          icon: Briefcase, label: 'Admin Settings' },
];

function TopNav() {
  const { user, logout } = useAuth();
  const [showMore, setShowMore] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'DU';

  useEffect(() => { setShowMore(false); setNavOpen(false); }, [location.pathname]);

  const userRole = user?.role || 'Viewer';
  const visibleNav = NAV_ITEMS.filter(item => canAccessRoute(userRole, item.to));
  const visibleMore = MORE_ITEMS.filter(item => canAccessRoute(userRole, item.to));

  const closeNav = () => setNavOpen(false);

  return (
    <>
      {navOpen && <div className="mobile-nav-overlay" onClick={closeNav} />}
      <nav className={`topnav${navOpen ? ' nav-open' : ''}`}>
        <NavLink to="/" className="topnav-brand">
          <div className="topnav-logo">P</div>
          <span className="topnav-title">PropAgent</span>
          <span className="topnav-badge">RCIC CRM</span>
        </NavLink>

        <button className="hamburger-btn" onClick={() => setNavOpen(!navOpen)} aria-label="Toggle navigation">
          {navOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="topnav-links">
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}
              onClick={closeNav}
            >
              <item.icon size={16} /> {item.label}
            </NavLink>
          ))}

          {visibleMore.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className={`topnav-link ${visibleMore.some(m => location.pathname.startsWith(m.to)) ? 'active' : ''}`}
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
                    {visibleMore.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}
                        style={{ color: 'var(--text-secondary)', borderRadius: 8, padding: '10px 14px' }}
                        onClick={() => { setShowMore(false); closeNav(); }}
                      >
                        <item.icon size={16} /> {item.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile-only user + logout at bottom of drawer */}
          <div className="mobile-nav-footer">
            <div className="topnav-user" style={{ padding: '12px 14px' }}>
              <div className="topnav-user-avatar">{initials}</div>
              <div>
                <div className="topnav-user-name">{user?.name || 'Demo User'}</div>
                <div className="topnav-user-email">{user?.email || 'demo@propagent.ca'}</div>
              </div>
            </div>
            <button className="topnav-logout mobile-logout" onClick={logout}>
              <LogOut size={14} /> Sign Out
            </button>
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
          <button className="topnav-logout" onClick={logout}>
            <LogOut size={14} />
          </button>
        </div>
      </nav>
    </>
  );
}

function AdminShell({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav />
      <div className="page-content page-enter">
        {children}
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        user ? <Navigate to="/" /> : <LoginPage />
      } />
      <Route path="/pif/:token" element={<PIFForm />} />
      <Route path="/sign/:token" element={<SignPage />} />
      <Route path="/portal/:token/*" element={<ClientPortal />} />

      {/* Protected Admin shell */}
      <Route path="/*" element={
        user ? (
          <SessionWrapper user={user} onLogout={logout}>
            <AdminShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pipeline" element={
                  <ProtectedRoute path="/pipeline"><Pipeline /></ProtectedRoute>
                } />
                <Route path="/clients" element={
                  <ProtectedRoute path="/clients"><ClientList /></ProtectedRoute>
                } />
                <Route path="/clients/new" element={
                  <ProtectedRoute path="/clients"><CreateClient /></ProtectedRoute>
                } />
                <Route path="/clients/:id" element={
                  <ProtectedRoute path="/clients"><ClientList /></ProtectedRoute>
                } />
                <Route path="/tasks" element={
                  <ProtectedRoute path="/tasks"><Tasks /></ProtectedRoute>
                } />
                <Route path="/calendar" element={
                  <ProtectedRoute path="/calendar"><CalendarPage /></ProtectedRoute>
                } />
                <Route path="/retainers" element={
                  <ProtectedRoute path="/retainers"><TrustAccounting /></ProtectedRoute>
                } />
                <Route path="/users" element={
                  <ProtectedRoute roles={['Admin']}><UsersPage /></ProtectedRoute>
                } />
                <Route path="/ircc-updates" element={
                  <ProtectedRoute path="/ircc-updates"><ImmigrationUpdates /></ProtectedRoute>
                } />
                <Route path="/ircc-templates" element={
                  <ProtectedRoute path="/ircc-templates"><IRCCTemplates /></ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute roles={['Admin']}><AdminSettings /></ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AdminShell>
          </SessionWrapper>
        ) : (
          <Navigate to="/login" />
        )
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
