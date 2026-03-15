import { useState, useEffect } from 'react';
import { api } from '../api';
import { Mail, RefreshCw, Paperclip, Inbox } from 'lucide-react';

export default function EmailList({ clientId }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchEmails = () => {
    api.getClientEmails(clientId)
      .then(setEmails)
      .catch(() => setEmails([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEmails(); }, [clientId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncClientEmails(clientId);
      fetchEmails();
    } catch {}
    setSyncing(false);
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {emails.length} email{emails.length !== 1 ? 's' : ''} synced
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Emails'}
        </button>
      </div>

      {emails.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Inbox size={32} /></div>
            <div className="empty-title">No emails synced</div>
            <div className="empty-text">
              Connect your Outlook account in Settings, then click "Sync Emails" to fetch conversations with this client.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {emails.map(email => (
            <div key={email.id} className="card" style={{
              padding: '14px 18px', cursor: 'default',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Mail size={16} color="#3b82f6" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(email.received_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {email.from_name || email.from_email}
                    {email.has_attachments && (
                      <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)' }}>
                        <Paperclip size={10} /> Attachment
                      </span>
                    )}
                  </div>
                  {email.body_preview && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {email.body_preview}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
