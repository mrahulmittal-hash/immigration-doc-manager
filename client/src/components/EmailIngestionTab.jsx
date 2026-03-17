import { useState, useEffect } from 'react';
import { api } from '../api';
import { Mail, CheckCircle, XCircle, Loader, Save, Zap, RefreshCw, Unplug, ExternalLink, Server, Clock, Shield } from 'lucide-react';

const SYNC_OPTIONS = [
  { value: 'manual', label: 'Manual Only' },
  { value: '15min', label: 'Every 15 Minutes' },
  { value: '30min', label: 'Every 30 Minutes' },
  { value: '1hr', label: 'Every Hour' },
  { value: '2hr', label: 'Every 2 Hours' },
];

const PROVIDER_HELP_LINKS = {
  gmail: 'https://myaccount.google.com/apppasswords',
  gmail_workspace: 'https://myaccount.google.com/apppasswords',
  outlook: 'https://account.live.com/proofs/AppPassword',
  yahoo: 'https://login.yahoo.com/account/security/app-passwords',
  yahoo_business: 'https://login.yahoo.com/account/security/app-passwords',
  turbify: 'https://mail.turbify.com/login',
};

export default function EmailIngestionTab() {
  const [providers, setProviders] = useState({});
  const [config, setConfig] = useState({
    provider: '',
    email_address: '',
    app_password: '',
    sync_frequency: 'manual',
  });
  const [savedConfig, setSavedConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await api.getEmailIngestionConfig();
      setProviders(data.providers || {});
      if (data.config) {
        setConfig({
          provider: data.config.provider || '',
          email_address: data.config.email_address || '',
          app_password: data.config.app_password || '',
          sync_frequency: data.config.sync_frequency || 'manual',
        });
        setSavedConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to load email config:', err);
    }
    setLoading(false);
  }

  function update(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }));
    setTestResult(null);
    setSyncResult(null);
  }

  async function handleSave() {
    if (!config.provider) { setMsg('Please select a provider'); return; }
    if (!config.email_address) { setMsg('Please enter an email address'); return; }
    if (!config.app_password && !savedConfig) { setMsg('Please enter an app password'); return; }

    setSaving(true); setMsg('');
    try {
      await api.updateEmailIngestionConfig(config);
      setMsg('Settings saved successfully');
      await loadConfig();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message || 'Failed to save'); }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const result = await api.testEmailIngestionConnection({
        provider: config.provider,
        email_address: config.email_address,
        app_password: config.app_password,
      });
      setTestResult(result);
    } catch (err) { setTestResult({ success: false, message: err.message }); }
    setTesting(false);
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    try {
      const result = await api.syncEmailIngestion();
      setSyncResult(result);
    } catch (err) { setSyncResult({ error: true, message: err.message || err.error || 'Sync failed' }); }
    setSyncing(false);
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect email integration? This will stop automatic syncing.')) return;
    setDisconnecting(true);
    try {
      await api.disconnectEmailIngestion();
      setConfig({ provider: '', email_address: '', app_password: '', sync_frequency: 'manual' });
      setSavedConfig(null);
      setTestResult(null);
      setSyncResult(null);
      setMsg('Email integration disconnected');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message || 'Failed to disconnect'); }
    setDisconnecting(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;

  const selectedPreset = providers[config.provider];
  const isConfigured = !!savedConfig;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20 }}>
      {/* Left: Provider Selection + Credentials */}
      <div>
        {/* Provider selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            Email Provider
          </label>
          <div style={{ display: 'grid', gap: 6 }}>
            {Object.entries(providers).map(([key, p]) => (
              <label key={key} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10,
                border: `2px solid ${config.provider === key ? 'var(--primary)' : 'var(--border)'}`,
                background: config.provider === key ? 'rgba(99,102,241,0.04)' : 'var(--bg-subtle)',
                cursor: 'pointer', transition: 'all .15s',
              }}>
                <input type="radio" name="provider" value={key}
                  checked={config.provider === key}
                  onChange={() => update('provider', key)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{p.description}</div>
                </div>
                {config.provider === key && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'rgba(99,102,241,.1)', color: '#6366f1', fontWeight: 700 }}>
                    Selected
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* IMAP details (read-only, from preset) */}
        {selectedPreset && (
          <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server size={13} /> IMAP Server Settings (Auto-configured)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Host</label>
                <div style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 2, color: 'var(--text-secondary)' }}>{selectedPreset.host}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Port</label>
                <div style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 2, color: 'var(--text-secondary)' }}>{selectedPreset.port}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Security</label>
                <div style={{ fontSize: 12, marginTop: 2, color: '#10b981', fontWeight: 600 }}>
                  <Shield size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  TLS/SSL
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credentials */}
        {config.provider && (
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={14} /> Email Credentials
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Email Address</label>
                <input className="form-input" type="email" value={config.email_address}
                  placeholder="your.email@example.com"
                  onChange={e => update('email_address', e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>
                  App Password
                  {PROVIDER_HELP_LINKS[config.provider] && (
                    <a href={PROVIDER_HELP_LINKS[config.provider]} target="_blank" rel="noreferrer"
                      style={{ marginLeft: 8, fontSize: 10, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                      Generate App Password <ExternalLink size={9} style={{ verticalAlign: 'middle' }} />
                    </a>
                  )}
                </label>
                <input className="form-input" type="password" value={config.app_password}
                  placeholder="Enter app password from your email provider"
                  onChange={e => update('app_password', e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Sync Frequency</label>
                <select className="form-select" value={config.sync_frequency}
                  onChange={e => update('sync_frequency', e.target.value)}>
                  {SYNC_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !config.provider}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {config.provider && (
            <button className="btn btn-secondary" onClick={handleTest} disabled={testing}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {testing ? <Loader size={14} className="spin" /> : <Zap size={14} />}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}
          {isConfigured && (
            <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {syncing ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
          {isConfigured && (
            <button className="btn btn-secondary" onClick={handleDisconnect} disabled={disconnecting}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
              {disconnecting ? <Loader size={14} className="spin" /> : <Unplug size={14} />}
              Disconnect
            </button>
          )}
        </div>

        {/* Status messages */}
        {msg && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: msg.includes('success') || msg.includes('disconnected') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
            color: msg.includes('success') || msg.includes('disconnected') ? '#10b981' : '#ef4444',
          }}>
            {msg}
          </div>
        )}

        {testResult && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 10, fontSize: 13,
            border: `1px solid ${testResult.success ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
            background: testResult.success ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {testResult.success ? <CheckCircle size={18} style={{ color: '#10b981' }} /> : <XCircle size={18} style={{ color: '#ef4444' }} />}
            <div>
              <div style={{ fontWeight: 700, color: testResult.success ? '#059669' : '#dc2626' }}>
                {testResult.success ? 'Connection Successful' : 'Connection Failed'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{testResult.message}</div>
            </div>
          </div>
        )}

        {syncResult && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 10, fontSize: 13,
            border: `1px solid ${syncResult.error ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}`,
            background: syncResult.error ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {syncResult.error
              ? <XCircle size={18} style={{ color: '#ef4444' }} />
              : <CheckCircle size={18} style={{ color: '#10b981' }} />
            }
            <div>
              <div style={{ fontWeight: 700, color: syncResult.error ? '#dc2626' : '#059669' }}>
                {syncResult.error ? 'Sync Failed' : 'Sync Complete'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {syncResult.message}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Info panel */}
      <div>
        {/* Current Configuration */}
        <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            Current Configuration
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <InfoRow label="Status" value={
              isConfigured ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(16,185,129,.1)', color: '#10b981' }}>
                  Connected
                </span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(107,114,128,.1)', color: '#6b7280' }}>
                  Not Configured
                </span>
              )
            } />
            {isConfigured && (
              <>
                <InfoRow label="Provider" value={
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(99,102,241,.1)', color: '#6366f1' }}>
                    {providers[savedConfig.provider]?.label || savedConfig.provider}
                  </span>
                } />
                <InfoRow label="Email" value={
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{savedConfig.email_address}</span>
                } />
                <InfoRow label="Sync Frequency" value={
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {SYNC_OPTIONS.find(o => o.value === savedConfig.sync_frequency)?.label || savedConfig.sync_frequency}
                  </span>
                } />
                <InfoRow label="Last Sync" value={
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {savedConfig.last_sync_at ? formatRelativeTime(savedConfig.last_sync_at) : 'Never'}
                  </span>
                } />
                {savedConfig.last_sync_status && (
                  <InfoRow label="Last Sync Status" value={
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                      background: savedConfig.last_sync_status === 'success' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
                      color: savedConfig.last_sync_status === 'success' ? '#10b981' : '#ef4444',
                    }}>
                      {savedConfig.last_sync_status === 'success' ? 'Success' : 'Error'}
                    </span>
                  } />
                )}
                {savedConfig.last_sync_error && (
                  <div style={{ fontSize: 11, color: '#ef4444', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    {savedConfig.last_sync_error}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 16, padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={14} /> How Email Ingestion Works
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              <li>Generate an <strong>App Password</strong> from your email provider (not your regular password)</li>
              <li>Select your provider and enter your email + app password above</li>
              <li>Click <strong>Test Connection</strong> to verify credentials</li>
              <li>Choose a sync frequency or use manual sync</li>
              <li>The system reads incoming emails and matches senders to registered clients</li>
              <li>Attachments (PDF, DOC, images) are automatically saved to the client's document profile</li>
              <li>A review task is created for each new batch of documents</li>
            </ol>
          </div>
        </div>

        {/* App Password Help */}
        <div style={{ marginTop: 16, padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={14} /> App Password Setup Guide
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Why App Passwords?</strong> App passwords are provider-generated passwords specifically for third-party apps. They are more secure than using your regular password and can be revoked independently.
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {Object.entries(PROVIDER_HELP_LINKS).map(([key, url]) => {
                const p = providers[key];
                if (!p) return null;
                return (
                  <a key={key} href={url} target="_blank" rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
                      background: 'var(--bg)', border: '1px solid var(--border)', textDecoration: 'none',
                      color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                    }}>
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <ExternalLink size={12} style={{ color: 'var(--primary)' }} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      {value}
    </div>
  );
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay} day(s) ago`;
  return date.toLocaleDateString();
}
