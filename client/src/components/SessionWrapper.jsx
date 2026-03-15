import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function SessionWrapper({ children, user, onLogout }) {
    const timerRef = useRef(null);
    const navigate = useNavigate();

    const handleLogout = async () => {
        if (!user) return;
        
        try {
            await fetch('http://localhost:5000/api/users/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            localStorage.removeItem('crm_user');
            onLogout();
            navigate('/login');
        }
    };

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            console.log('Session idle timeout reached. Logging out...');
            handleLogout();
        }, TIMEOUT_MS);
    };

    useEffect(() => {
        if (!user) return;

        // Set initial timer
        resetTimer();

        // Listen for user activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        
        // Throttled event listener to prevent blasting resetTimer
        let isThrottled = false;
        const handleActivity = () => {
            if (isThrottled) return;
            isThrottled = true;
            resetTimer();
            setTimeout(() => { isThrottled = false; }, 1000); // 1 sec throttle
        };

        events.forEach(e => window.addEventListener(e, handleActivity));

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(e => window.removeEventListener(e, handleActivity));
        };
    }, [user]);

    // Expose a floating manual logout button for testing
    return (
        <div style={{ position: 'relative', height: '100%' }}>
            {children}
            {user && (
                <button 
                    onClick={handleLogout}
                    style={{
                        position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
                        background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none',
                        padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                    }}>
                    Logout (Test)
                </button>
            )}
        </div>
    );
}
