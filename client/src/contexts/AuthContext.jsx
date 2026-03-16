import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('crm_user');
        if (stored) {
            try { setUser(JSON.parse(stored)); } catch {}
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email, password) => {
        const data = await api.login(email, password);
        if (data.ok !== false && data.accessToken) {
            localStorage.setItem('crm_user', JSON.stringify(data.user));
            localStorage.setItem('crm_access_token', data.accessToken);
            localStorage.setItem('crm_refresh_token', data.refreshToken);
            setUser(data.user);
            return { success: true };
        }
        return { success: false, error: data.error || 'Login failed' };
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('crm_user');
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
