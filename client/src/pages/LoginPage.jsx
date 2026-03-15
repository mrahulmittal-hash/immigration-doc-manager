import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('crm_user', JSON.stringify(data.user));
                onLogin(data.user);
                navigate('/');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif'
        }}>
            <div className="card" style={{
                width: '100%', maxWidth: 400, padding: 40, borderRadius: 24,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, var(--primary), var(--accent-purple))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                        boxShadow: '0 8px 16px var(--primary-glow)'
                    }}>
                        <Building2 size={28} color="#fff" />
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>PropAgent CRM</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Sign in to manage your practice</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {error && (
                        <div style={{
                            padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 8, color: '#f87171', fontSize: 13, textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="sarah@propagent.ca"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '14px', borderRadius: 8,
                            fontSize: 14, marginTop: 10, justifyContent: 'center'
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                        <p>For demo purposes, use <strong style={{ color: 'var(--text-secondary)' }}>sarah@propagent.ca</strong></p>
                    </div>
                </form>
            </div>
        </div>
    );
}
