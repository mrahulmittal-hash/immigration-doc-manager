import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Search, Bell, MessageSquare } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import ClientList from './pages/ClientList';
import CreateClient from './pages/CreateClient';
import ClientDetail from './pages/ClientDetail';
import Tasks from './pages/Tasks';
import CalendarPage from './pages/CalendarPage';
import Retainers from './pages/Retainers';
import PIFForm from './pages/PIFForm';
import UsersPage from './pages/UsersPage';
import ImmigrationUpdates from './pages/ImmigrationUpdates';
import EmailSettings from './pages/EmailSettings';
import LoginPage from './pages/LoginPage';
import SessionWrapper from './components/SessionWrapper';
import './index.css';

const BREADCRUMBS = {
  '/': 'Dashboard',
  '/pipeline': 'Pipeline',
  '/clients': 'Clients',
  '/clients/new': 'New Client',
  '/tasks': 'Tasks',
  '/calendar': 'Calendar',
  '/retainers': 'Retainers',
  '/users': 'User Management',
  '/ircc-updates': 'IRCC Updates',
  '/settings/email': 'Email Integration',
};

function Breadcrumb() {
  const location = useLocation();
  const path = location.pathname;
  const label = BREADCRUMBS[path] || (path.startsWith('/clients/') ? 'Client Detail' : 'Dashboard');
  return <div className="topbar-title">{label}</div>;
}

function AdminShell({ children, user }) {
  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <div className="main-area">
        <header className="topbar">
          <Breadcrumb />
          <div className="topbar-search">
            <Search size={14} style={{ opacity: 0.5 }} />
            <input type="text" placeholder="Quick search..." />
            <kbd className="topbar-kbd">⌘K</kbd>
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn">
              <Bell size={18} />
              <span className="topbar-btn-dot" />
            </button>
            <button className="topbar-btn">
              <MessageSquare size={18} />
            </button>
          </div>
        </header>
        <div className="page-content page-enter">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('crm_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          user ? <Navigate to="/" /> : <LoginPage onLogin={setUser} />
        } />
        <Route path="/pif/:token" element={<PIFForm />} />

        {/* Protected Admin shell */}
        <Route path="/*" element={
          user ? (
            <SessionWrapper user={user} onLogout={handleLogout}>
              <AdminShell user={user}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pipeline" element={<Pipeline />} />
                  <Route path="/clients" element={<ClientList />} />
                  <Route path="/clients/new" element={<CreateClient />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/retainers" element={<Retainers />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/ircc-updates" element={<ImmigrationUpdates />} />
                  <Route path="/settings/email" element={<EmailSettings />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </AdminShell>
            </SessionWrapper>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}
