import { useState, useEffect } from 'react';
import { History, Filter, ArrowRight, User, FileText, Shield, CheckCircle, Edit3, Trash2, Plus } from 'lucide-react';
import { api } from '../api';

const ACTION_ICONS = {
    create: Plus,
    update: Edit3,
    delete: Trash2,
    verify: CheckCircle,
    flag: Shield,
    generate: FileText,
};

const ACTION_COLORS = {
    create: '#10b981',
    update: '#3b82f6',
    delete: '#ef4444',
    verify: '#10b981',
    flag: '#f59e0b',
    generate: '#8b5cf6',
};

const ENTITY_LABELS = {
    client: 'Client',
    pif: 'PIF',
    form: 'Form',
    verification: 'Verification',
    document: 'Document',
};

export default function AuditLog({ clientId }) {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ entity_type: '', limit: 50 });

    useEffect(() => {
        loadLogs();
    }, [clientId, filter]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filter.entity_type) params.entity_type = filter.entity_type;
            params.limit = filter.limit;
            const data = await api.getAuditLog(clientId, params);
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to load audit log:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return dt.toLocaleDateString('en-CA') + ' ' + dt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
    };

    const truncate = (s, len = 60) => s && s.length > len ? s.slice(0, len) + '...' : s;

    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <History size={20} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Audit Log</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 10 }}>
                        {total} entries
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                    <select
                        value={filter.entity_type}
                        onChange={e => setFilter(f => ({ ...f, entity_type: e.target.value }))}
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 12, width: 'auto' }}
                    >
                        <option value="">All Types</option>
                        <option value="client">Client</option>
                        <option value="pif">PIF</option>
                        <option value="verification">Verification</option>
                        <option value="form">Form</option>
                        <option value="document">Document</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
            ) : logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No audit entries found
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {logs.map(log => {
                        const Icon = ACTION_ICONS[log.action] || Edit3;
                        const color = ACTION_COLORS[log.action] || '#6b7280';
                        return (
                            <div key={log.id} style={{
                                display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8,
                                background: 'var(--bg-secondary)', alignItems: 'flex-start'
                            }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: 6, background: `${color}15`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <Icon size={14} style={{ color }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                            background: `${color}15`, color, fontWeight: 600, textTransform: 'uppercase'
                                        }}>
                                            {log.action}
                                        </span>
                                        <span style={{
                                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                            background: 'var(--bg-base)', color: 'var(--text-muted)', fontWeight: 500
                                        }}>
                                            {ENTITY_LABELS[log.entity_type] || log.entity_type}
                                        </span>
                                        {log.field_key && (
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                {log.field_key}
                                            </span>
                                        )}
                                    </div>
                                    {(log.old_value || log.new_value) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12 }}>
                                            {log.old_value && (
                                                <span style={{ color: '#ef4444', textDecoration: 'line-through', opacity: 0.7 }}>
                                                    {truncate(log.old_value)}
                                                </span>
                                            )}
                                            {log.old_value && log.new_value && <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />}
                                            {log.new_value && (
                                                <span style={{ color: '#10b981' }}>{truncate(log.new_value)}</span>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <User size={10} /> {log.changed_by_name || 'System'}
                                        </span>
                                        <span>{formatDate(log.changed_at)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
