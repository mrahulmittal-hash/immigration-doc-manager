/**
 * authMiddleware.js — JWT authentication middleware
 *
 * Validates Bearer tokens using a local JWT_SECRET.
 * In local development (no JWT_SECRET), passes through with a real user from DB.
 */

const jwt = require('jsonwebtoken');
const { prepareGet } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || null;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function getSecret() {
    return JWT_SECRET || 'dev-secret-do-not-use-in-production';
}

/**
 * Generate access and refresh tokens for a user
 */
function generateTokens(user) {
    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const accessToken = jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign({ id: user.id, type: 'refresh' }, getSecret(), { expiresIn: REFRESH_TOKEN_EXPIRY });
    return { accessToken, refreshToken };
}

/**
 * requireAuth — validates the Bearer JWT.
 * Attaches decoded payload to req.user.
 * In dev mode (no JWT_SECRET), looks up a default user from DB.
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
        try {
            const decoded = jwt.verify(token, getSecret());
            req.user = { id: decoded.id, email: decoded.email, role: decoded.role, name: decoded.name };
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }

    // Dev pass-through: no token provided and no JWT_SECRET configured
    if (!JWT_SECRET) {
        const devUser = await prepareGet("SELECT id, name, email, role FROM users WHERE status = 'active' ORDER BY id ASC LIMIT 1");
        req.user = devUser || { id: 1, email: 'dev@propagent.ca', role: 'Admin', name: 'Dev User' };
        return next();
    }

    return res.status(401).json({ error: 'Authorization token required' });
}

/**
 * requireRole(...roles) — verifies that the authenticated user has one of the specified roles.
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole, generateTokens, getSecret };
