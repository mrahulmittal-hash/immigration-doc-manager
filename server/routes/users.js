const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { generateTokens, getSecret, requireRole, requireAuth } = require('../middleware/auth');

// GET /api/users/case-managers — list users eligible for case assignment
router.get('/case-managers', requireAuth, async (req, res) => {
    try {
        const users = await prepareAll(
            `SELECT id, name, email, role FROM users
             WHERE status = 'active' AND role IN ('Admin', 'Case Manager', 'RCIC Consultant')
             ORDER BY name`
        );
        res.json(users);
    } catch (err) {
        console.error('Error fetching case managers:', err);
        res.status(500).json({ error: 'Failed to fetch case managers' });
    }
});

// GET /api/users — list all users with session info (protected)
router.get('/', requireAuth, async (req, res) => {
    try {
        const users = await prepareAll('SELECT id, name, email, role, status FROM users ORDER BY created_at ASC');

        const todaySessions = await prepareAll(`
            SELECT user_id, type, timestamp
            FROM employee_sessions
            WHERE timestamp >= CURRENT_DATE
            ORDER BY user_id, timestamp ASC
        `);

        const userActivity = {};
        for (const session of todaySessions) {
            if (!userActivity[session.user_id]) {
                userActivity[session.user_id] = { sessions: [], hoursToday: 0 };
            }
            userActivity[session.user_id].sessions.push(session);
        }

        for (const userId in userActivity) {
            const sessions = userActivity[userId].sessions;
            let totalMs = 0;
            let loginTime = null;
            for (const s of sessions) {
                if (s.type === 'login') {
                    loginTime = new Date(s.timestamp).getTime();
                } else if (s.type === 'logout' && loginTime) {
                    totalMs += (new Date(s.timestamp).getTime() - loginTime);
                    loginTime = null;
                }
            }
            if (loginTime) totalMs += (Date.now() - loginTime);
            userActivity[userId].hoursToday = (totalMs / (1000 * 60 * 60)).toFixed(1);
        }

        const enrichedUsers = await Promise.all(users.map(async u => {
            const lastLogin = await prepareGet(
                "SELECT timestamp FROM employee_sessions WHERE user_id = $1 AND type = 'login' ORDER BY timestamp DESC LIMIT 1",
                u.id
            );
            const initials = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return {
                ...u,
                avatar: initials,
                lastLogin: lastLogin?.timestamp ? new Date(lastLogin.timestamp).toISOString().split('T')[0] : '—',
                hoursToday: userActivity[u.id]?.hoursToday || "0.0"
            };
        }));

        res.json(enrichedUsers);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/users/login — authenticate with email + password, return JWT
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = await prepareGet('SELECT * FROM users WHERE email = $1 AND status = $2', email, 'active');
        if (!user) {
            return res.status(404).json({ error: 'User not found or inactive' });
        }

        // If password provided and user has a hash, verify it
        if (password && user.password_hash) {
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                return res.status(401).json({ error: 'Invalid password' });
            }
        } else if (user.password_hash && !password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        // If no password_hash set (legacy), allow login with just email

        // Generate JWT tokens
        const { accessToken, refreshToken } = generateTokens(user);

        // Store refresh token
        const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prepareRun(
            'UPDATE users SET refresh_token = $1, refresh_token_expires = $2 WHERE id = $3',
            refreshToken, refreshExpires, user.id
        );

        // Log session
        await prepareRun("INSERT INTO employee_sessions (user_id, type) VALUES ($1, 'login')", user.id);

        res.json({
            message: 'Login successful',
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            accessToken,
            refreshToken
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/users/refresh — refresh access token
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    try {
        const decoded = jwt.verify(refreshToken, getSecret());
        const user = await prepareGet(
            'SELECT * FROM users WHERE id = $1 AND refresh_token = $2 AND refresh_token_expires > NOW()',
            decoded.id, refreshToken
        );
        if (!user) return res.status(401).json({ error: 'Invalid refresh token' });

        const tokens = generateTokens(user);
        const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prepareRun(
            'UPDATE users SET refresh_token = $1, refresh_token_expires = $2 WHERE id = $3',
            tokens.refreshToken, refreshExpires, user.id
        );

        res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});

// POST /api/users/register — create new user (Admin only)
router.post('/register', requireAuth, requireRole('Admin'), async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        const existing = await prepareGet('SELECT id FROM users WHERE email = $1', email);
        if (existing) return res.status(409).json({ error: 'User with this email already exists' });

        const hash = await bcrypt.hash(password, 10);
        const result = await prepareRun(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            name, email, hash, role || 'Case Manager'
        );

        res.status(201).json({ id: result.lastInsertRowid, name, email, role: role || 'Case Manager' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PUT /api/users/:id/password — change password (Admin or self)
router.put('/:id/password', requireAuth, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { currentPassword, newPassword } = req.body;

    if (req.user.id !== userId && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Can only change your own password' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const user = await prepareGet('SELECT * FROM users WHERE id = $1', userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Non-admin must verify current password
        if (req.user.role !== 'Admin' && user.password_hash) {
            if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
            const valid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await prepareRun('UPDATE users SET password_hash = $1 WHERE id = $2', hash, userId);
        res.json({ message: 'Password updated' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// GET /api/users/me — get current user from token
router.get('/me', requireAuth, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(req.user);
});

// POST /api/users/logout
router.post('/logout', async (req, res) => {
    const userId = req.body.userId || req.user?.id;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    try {
        await prepareRun("INSERT INTO employee_sessions (user_id, type) VALUES ($1, 'logout')", userId);
        await prepareRun('UPDATE users SET refresh_token = NULL, refresh_token_expires = NULL WHERE id = $1', userId);
        res.json({ message: 'Logout successful' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

module.exports = router;
