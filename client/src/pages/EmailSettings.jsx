import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Mail, Link2, Unlink, RefreshCw, CheckCircle, AlertCircle, Settings,
  Bell, FileText, Key, Shield
} from 'lucide-react';

const SETTINGS_NAV = [
  { id: 'email', icon: Mail, label: 'Email Integration', desc: 'Outlook / Microsoft 365' },
  { id: 'notifications', icon: Bell, label: 'Notifications', desc: 'Coming soon' },
  { id: 'templates', icon: FileText, label: 'Templates', desc: 'Coming soon' },
  { id: 'api', icon: Key, label: 'API Keys', desc: 'Coming soon' },
];

export default function EmailSettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeSection, setActiveSection] = useState('email');

  useEffect(() => {
    api.getEmailStatus().then(setStatus).finally(() => setLoading(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      setMessage({ type: 'success', text: 'Successfully connected to Outlook!' });
      window.history.replaceState({}, '', '/settings/email');
    } else if (params.get('error')) {
      setMessage({ type: 'error', text: `Connection failed: ${params.get('error')}` });
      window.history.replaceState({}, '', '/settings/email');
    }
  }, []);

  const handleConnect = async () => {
    try {
      const { auth_url } = await api.connectEmail();
      window.location.href = auth_url;
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your Outlook account?')) return;
    await api.disconnectEmail();
    setStatus(prev => ({ ...prev, connected: false, email: null }));
    setMessage({ type: 'success', text: 'Disconnected from Outlook' });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await api.syncEmails();
      setMessage({ type: 'success', text: `Synced ${result.synced} emails across all clients` });
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setSyncing(false);
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div className="clients-3panel">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Settings</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Configure your workspace</div>
        </div>

        <div className="clients-list">
          {SETTINGS_NAV.map(item => (
            <div key={item.id}
              className={`clients-list-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
              style={{ opacity: item.id === 'email' ? 1 : 0.5, cursor: item.id === 'email' ? 'pointer' : 'default' }}
            >
              <div className="clients-item-avatar" style={{
                background: activeSection === item.id ? 'linear-gradient(135deg, #0d9488, #0f766e)' : 'var(--bg-elevated)',
                color: activeSection === item.id ? '#fff' : 'var(--text-muted)',
                borderColor: activeSection === item.id ? 'transparent' : 'var(--border)',
              }}>
                <item.icon size={16} />
              </div>
              <div className="clients-item-info">
                <div className="clients-item-name">{item.label}</div>
                <div className="clients-item-meta">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {message && (
            <div className="clients-detail-card" style={{
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10,
              background: message.type === 'success' ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
              border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`,
            }}>
              {message.type === 'success' ? <CheckCircle size={16} color="#10b981" /> : <AlertCircle size={16} color="#ef4444" />}
              <span style={{ fontSize: 13, color: message.type === 'success' ? '#10b981' : '#ef4444' }}>{message.text}</span>
            </div>
          )}

          {activeSection === 'email' ? (
            <div className="clients-detail-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(59,130,246,.1), rgba(139,92,246,.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#3b82f6',
                }}>
                  <Mail size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Microsoft Outlook Connection</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Connect your Microsoft 365 / Outlook account to sync emails
                  </div>
                </div>
              </div>

              {!status?.configured ? (
                <div>
                  <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
                    <Settings size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Azure AD Not Configured</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                      Add these environment variables to your server .env file:
                    </div>
                  </div>
                  <div style={{
                    background: 'var(--bg-elevated)', borderRadius: 10, padding: 20,
                    fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2,
                    border: '1px solid var(--border-light)',
                  }}>
                    AZURE_CLIENT_ID=your_app_id<br />
                    AZURE_CLIENT_SECRET=your_secret<br />
                    AZURE_TENANT_ID=your_tenant_id<br />
                    AZURE_REDIRECT_URI=http://localhost:3001/api/emails/callback
                  </div>
                </div>
              ) : status?.connected ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, padding: 16, background: 'rgba(16,185,129,.04)', borderRadius: 10, border: '1px solid rgba(16,185,129,.15)' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CheckCircle size={24} color="#10b981" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>Connected</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{status.email}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={handleSync} disabled={syncing}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                      {syncing ? 'Syncing...' : 'Sync All Emails'}
                    </button>
                    <button className="btn btn-ghost" onClick={handleDisconnect}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                      <Unlink size={14} /> Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                    Connect your Microsoft 365 / Outlook account to automatically sync emails
                    between you and your clients. Emails will appear in each client's timeline.
                  </p>
                  <button className="btn btn-primary" onClick={handleConnect}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link2 size={16} /> Connect Microsoft Outlook
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Placeholder for future settings sections */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
              <Settings size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Coming Soon</div>
              <div style={{ fontSize: 13 }}>This settings section is under development</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        {/* Connection Status */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Connection Status</div>
          <div className="clients-ctx-row">
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: status?.connected ? '#10b981' : status?.configured ? '#f59e0b' : '#9ca3af',
              boxShadow: status?.connected ? '0 0 6px rgba(16,185,129,.5)' : 'none',
            }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {status?.connected ? 'Connected' : status?.configured ? 'Disconnected' : 'Not Configured'}
            </span>
          </div>
          {status?.email && (
            <div className="clients-ctx-row">
              <Mail size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12 }}>{status.email}</span>
            </div>
          )}
        </div>

        {/* Integration Info */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">What It Does</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Email integration syncs your Outlook inbox with client records. Emails are automatically matched
            to clients based on their email addresses and appear in each client's timeline.
          </div>
        </div>

        {/* Requirements */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Requirements</div>
          {['Microsoft 365 account', 'Azure AD app registration', 'Admin consent for Mail.Read', 'Server environment variables'].map(req => (
            <div key={req} className="clients-ctx-row">
              <Shield size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12 }}>{req}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
