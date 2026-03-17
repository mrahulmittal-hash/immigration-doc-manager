import { useState, useEffect } from 'react';
import { api } from '../api';
import { Shield, CheckCircle, XCircle, Loader, Save, Zap, Pen } from 'lucide-react';

const PROVIDERS = [
  { value: 'docusign', label: 'DocuSign', description: 'Send agreements for e-signature via DocuSign' },
  { value: 'builtin', label: 'Built-in (Self-hosted)', description: 'Use the built-in signing portal for clients' },
];

export default function SigningSettingsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await api.getSigningSettings();
      setSettings(data);
    } catch (err) {
      setSettings({ provider: 'builtin' });
    }
    setLoading(false);
  }

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setTestResult(null);
  }

  async function handleSave() {
    setSaving(true); setMsg('');
    try {
      await api.updateSigningSettings(settings);
      setMsg('Settings saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message || 'Failed to save'); }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const result = await api.testSigningConnection();
      setTestResult(result);
    } catch (err) { setTestResult({ success: false, message: err.message }); }
    setTesting(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;

  const isDocuSign = settings?.provider === 'docusign';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20 }}>
      {/* Left: Provider Selection + Credentials */}
      <div>
        {/* Provider selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            Signing Service Provider
          </label>
          {PROVIDERS.map(p => (
            <label key={p.value} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10,
              border: `2px solid ${settings?.provider === p.value ? 'var(--primary)' : 'var(--border)'}`,
              background: settings?.provider === p.value ? 'rgba(99,102,241,0.04)' : 'var(--bg-subtle)',
              cursor: 'pointer', marginBottom: 8, transition: 'all .15s',
            }}>
              <input type="radio" name="provider" value={p.value}
                checked={settings?.provider === p.value}
                onChange={() => update('provider', p.value)}
                style={{ accentColor: 'var(--primary)' }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* DocuSign credentials (only when DocuSign selected) */}
        {isDocuSign && (
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} /> DocuSign Credentials
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Account ID</label>
                <input className="form-input" value={settings.docusign_account_id || ''} placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  onChange={e => update('docusign_account_id', e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Integration Key (Client ID)</label>
                <input className="form-input" value={settings.docusign_integration_key || ''} placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  onChange={e => update('docusign_integration_key', e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Secret Key</label>
                <input className="form-input" type="password" value={settings.docusign_secret || ''} placeholder="Enter secret key"
                  onChange={e => update('docusign_secret', e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Environment</label>
                <select className="form-select" value={settings.docusign_base_url?.includes('demo') ? 'demo' : 'production'}
                  onChange={e => {
                    const isDemoEnv = e.target.value === 'demo';
                    update('docusign_base_url', isDemoEnv ? 'https://demo.docusign.net/restapi' : 'https://na1.docusign.net/restapi');
                    update('docusign_oauth_url', isDemoEnv ? 'https://account-d.docusign.com' : 'https://account.docusign.com');
                  }}>
                  <option value="demo">Demo / Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {isDocuSign && (
            <button className="btn btn-secondary" onClick={handleTest} disabled={testing}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {testing ? <Loader size={14} className="spin" /> : <Zap size={14} />}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}
        </div>

        {msg && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: msg.includes('success') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
            color: msg.includes('success') ? '#10b981' : '#ef4444',
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
      </div>

      {/* Right: Info panel */}
      <div>
        <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            Current Configuration
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active Provider</span>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                background: isDocuSign ? 'rgba(99,102,241,.1)' : 'rgba(16,185,129,.1)',
                color: isDocuSign ? '#6366f1' : '#10b981',
              }}>
                {isDocuSign ? 'DocuSign' : 'Built-in'}
              </span>
            </div>
            {isDocuSign && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Environment</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {settings.docusign_base_url?.includes('demo') ? 'Demo / Sandbox' : 'Production'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account ID</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>
                    {settings.docusign_account_id ? `${settings.docusign_account_id.substring(0, 8)}...` : 'Not set'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Integration Key</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>
                    {settings.docusign_integration_key ? `${settings.docusign_integration_key.substring(0, 8)}...` : 'Not set'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 16, padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pen size={14} /> How Signing Works
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {isDocuSign ? (
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                <li>Generate a retainer agreement from the client profile</li>
                <li>Click "Send for Signing" to create a DocuSign envelope</li>
                <li>Client receives an email from DocuSign to review and sign</li>
                <li>Once signed, DocuSign notifies the system via webhook</li>
                <li>Case progress auto-advances to "Retainer Signed"</li>
              </ol>
            ) : (
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                <li>Generate a retainer agreement from the client profile</li>
                <li>Click "Send for Signing" to create a signing link</li>
                <li>Client receives an email with a secure link to sign</li>
                <li>Client draws their signature on the signing page</li>
                <li>Case progress auto-advances to "Retainer Signed"</li>
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
