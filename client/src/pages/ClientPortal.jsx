import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Globe, FileText, CheckSquare, Clock, Loader, AlertCircle } from 'lucide-react';
import { API_URL } from '../api';
import PortalStatus from './portal/PortalStatus';
import PortalChecklist from './portal/PortalChecklist';
import PortalDocuments from './portal/PortalDocuments';

const TABS = [
  { id: 'status', label: 'Status', icon: Clock },
  { id: 'checklist', label: 'Checklist', icon: CheckSquare },
  { id: 'documents', label: 'Documents', icon: FileText },
];

export default function ClientPortal() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('status');

  useEffect(() => {
    fetch(`${API_URL}/api/portal/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => setError('Failed to load portal'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Loader size={32} className="spin" style={{ color: '#6366f1' }} />
    </div>
  );

  if (error) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <AlertCircle size={48} color="#ef4444" />
        <h2 style={{ marginTop: 16, color: '#1a1a2e' }}>Portal Unavailable</h2>
        <p style={{ color: '#64748b' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
        padding: '24px 0', borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: '#fff', margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Globe size={22} />
                PropAgent Portal
              </h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{info.client_name}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>{info.visa_type || 'Immigration Application'}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '14px 20px', border: 'none', background: 'none',
                  fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer',
                  color: active ? '#6366f1' : '#64748b',
                  borderBottom: `2px solid ${active ? '#6366f1' : 'transparent'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        {activeTab === 'status' && <PortalStatus token={token} />}
        {activeTab === 'checklist' && <PortalChecklist token={token} />}
        {activeTab === 'documents' && <PortalDocuments token={token} />}
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: 12 }}>
        Powered by PropAgent • RCIC Immigration Services
      </footer>
    </div>
  );
}
