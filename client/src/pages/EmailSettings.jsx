import { useState, useEffect } from 'react';
import { api } from '../api';
import { Mail, Link2, Unlink, RefreshCw, CheckCircle, AlertCircle, Settings } from 'lucide-react';

export default function EmailSettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.getEmailStatus().then(setStatus).finally(() => setLoading(false));

    // Check URL params for callback result
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
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
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
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setSyncing(false);
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Email Integration</div>
          <div className="page-subtitle">Connect your Outlook / Microsoft 365 account to sync client emails</div>
        </div>
      </div>

      {message && (
        <div className="card" style={{
          padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
          background: message.type === 'success' ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`,
        }}>
          {message.type === 'success' ? <CheckCircle size={16} color="#10b981" /> : <AlertCircle size={16} color="#ef4444" />}
          <span style={{ fontSize: 13, color: message.type === 'success' ? '#10b981' : '#ef4444' }}>{message.text}</span>
        </div>
      )}

      <div className="card" style={{ maxWidth: 600 }}>
        <div className="card-header" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} /> Microsoft Outlook Connection
          </div>
        </div>

        {!status?.configured ? (
          <div className="empty">
            <div className="empty-icon"><Settings size={32} /></div>
            <div className="empty-title">Azure AD Not Configured</div>
            <div className="empty-text">
              To enable email integration, add these environment variables to your server .env file:
            </div>
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 8, padding: 16, marginTop: 16,
              fontFamily: 'monospace', fontSize: 12, textAlign: 'left', width: '100%',
              color: 'var(--text-secondary)', lineHeight: 1.8,
            }}>
              AZURE_CLIENT_ID=your_app_id<br />
              AZURE_CLIENT_SECRET=your_secret<br />
              AZURE_TENANT_ID=your_tenant_id<br />
              AZURE_REDIRECT_URI=http://localhost:3001/api/emails/callback
            </div>
          </div>
        ) : status?.connected ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle size={24} color="#10b981" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Connected</div>
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
    </div>
  );
}
