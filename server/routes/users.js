const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/users
// Fetch all users and calculate their active hours for today
router.get('/', async (req, res) => {
    try {
        const users = await prepareAll('SELECT id, name, email, role, status FROM users ORDER BY created_at ASC');
        
        // Get today's start and end in DB format (simple date-based filter)
        // PostgreSQL timezone handling can be tricky, we'll use simple cast to DATE
        
        // Calculate hours logged today for each user
        const todaySessions = await prepareAll(`
            SELECT user_id, type, timestamp 
            FROM employee_sessions 
            WHERE timestamp >= CURRENT_DATE 
            ORDER BY user_id, timestamp ASC
        `);

        // Group sessions by user
        const userActivity = {};
        for (const session of todaySessions) {
            if (!userActivity[session.user_id]) {
                userActivity[session.user_id] = { sessions: [], hoursToday: 0 };
            }
            userActivity[session.user_id].sessions.push(session);
        }

        // Calculate hours
        for (const userId in userActivity) {
            const sessions = userActivity[userId].sessions;
            let totalMs = 0;
            let loginTime = null;

            for (const s of sessions) {
                if (s.type === 'login') {
                    loginTime = new Date(s.timestamp).getTime();
                } else if (s.type === 'logout' && loginTime) {
                    const logoutTime = new Date(s.timestamp).getTime();
                    totalMs += (logoutTime - loginTime);
                    loginTime = null; // reset for next pair
                }
            }

            // If there's an active login without a logout, calculate up to NOW
            if (loginTime) {
                totalMs += (Date.now() - loginTime);
            }

            // Convert to hours with 1 decimal place
            userActivity[userId].hoursToday = (totalMs / (1000 * 60 * 60)).toFixed(1);
        }

        // Attach last login logic and hours
        const enrichedUsers = await Promise.all(users.map(async u => {
            const lastLogin = await prepareGet(
                "SELECT timestamp FROM employee_sessions WHERE user_id = $1 AND type = 'login' ORDER BY timestamp DESC LIMIT 1",
                u.id
            );
            
            let lastLoginStr = '—';
            if (lastLogin && lastLogin.timestamp) {
                lastLoginStr = new Date(lastLogin.timestamp).toISOString().split('T')[0]; // simple YYYY-MM-DD
            }

            const initials = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            
            return {
                ...u,
                avatar: initials,
                lastLogin: lastLoginStr,
                hoursToday: userActivity[u.id]?.hoursToday || "0.0"
            };
        }));

        res.json(enrichedUsers);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = await prepareGet('SELECT * FROM users WHERE email = $1 AND status = $2', email, 'active');
        if (!user) {
            return res.status(404).json({ error: 'User not found or inactive. (Try sarah@propagent.ca)' });
        }

        // Log the session login
        await prepareRun(
            "INSERT INTO employee_sessions (user_id, type) VALUES ($1, 'login')",
            user.id
        );

        // In a real app we'd issue a JWT here, but we'll just return the user object
        res.json({ message: 'Login successful', user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/users/logout
router.post('/logout', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    try {
        // Log the session logout
        await prepareRun(
            "INSERT INTO employee_sessions (user_id, type) VALUES ($1, 'logout')",
            userId
        );
        res.json({ message: 'Logout successful' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

module.exports = router;
