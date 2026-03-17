import { useState } from 'react';
import { Users, DollarSign, FileText, Building, Shield } from 'lucide-react';
import UsersPage from './UsersPage';
import ServiceFeesTab from '../components/ServiceFeesTab';
import RetainerTemplateTab from '../components/RetainerTemplateTab';
import FirmProfileTab from '../components/FirmProfileTab';
import SigningSettingsTab from '../components/SigningSettingsTab';

const TABS = [
  { key: 'users', label: 'Users', Icon: Users },
  { key: 'fees', label: 'Service Fees', Icon: DollarSign },
  { key: 'template', label: 'Retainer Template', Icon: FileText },
  { key: 'firm', label: 'Firm Profile', Icon: Building },
  { key: 'signing', label: 'Signing Service', Icon: Shield },
];

export default function AdminSettings() {
  const [tab, setTab] = useState('users');

  return (
    <div>
      <div style={{ marginBottom: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Admin Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Manage users, service fees, retainer templates, firm profile, and signing service</p>
      </div>

      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.Icon size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersPage embedded />}
      {tab === 'fees' && <ServiceFeesTab />}
      {tab === 'template' && <RetainerTemplateTab />}
      {tab === 'firm' && <FirmProfileTab />}
      {tab === 'signing' && <SigningSettingsTab />}
    </div>
  );
}
