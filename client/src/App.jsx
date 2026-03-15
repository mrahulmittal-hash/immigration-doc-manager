import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import LoginPage from './pages/LoginPage';
import SessionWrapper from './components/SessionWrapper';
import './index.css';

function AdminShell({ children, user }) {
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'SK';

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">Overview</div>
          <div className="topbar-search">
            <span style={{opacity: 0.6}}>🔍</span>
            <input type="text" placeholder="Quick search..." />
            <span style={{ opacity: 0.5, fontSize: 10, background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:4 }}>⌘K</span>
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn">🔔</button>
            <button className="topbar-btn">💬</button>
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
    // Check if user is already logged in (simulated auth persistence)
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
