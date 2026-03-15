/**
 * authMiddleware.js — Cognito JWT validation middleware
 *
 * When COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are configured, validates
 * Bearer tokens against the Cognito JWKS endpoint.
 *
 * In local development (no Cognito config), the middleware passes through
 * all requests so the app keeps working without an AWS account.
 *
 * Usage:
 *   const { requireAuth, requireRole } = require('./middleware/auth');
 *   app.use('/api/clients', requireAuth, clientsRouter);
 *   app.use('/api/admin', requireAuth, requireRole('RCIC', 'CaseOfficer'), adminRouter);
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const USER_POOL_ID    = process.env.COGNITO_USER_POOL_ID;
const REGION          = process.env.AWS_REGION || 'ca-central-1';
const CLIENT_ID       = process.env.COGNITO_CLIENT_ID;

function isCognitoEnabled() {
    return !!(USER_POOL_ID && REGION && CLIENT_ID);
}

// Lazy-build JWKS client
let _jwksClient = null;
function getJwksClient() {
    if (!_jwksClient) {
        _jwksClient = jwksClient({
            jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 10 * 60 * 1000, // 10 minutes
        });
    }
    return _jwksClient;
}

function getKey(header, callback) {
    getJwksClient().getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
    });
}

/**
 * requireAuth — validates the Bearer JWT.
 * Attaches decoded payload to req.user.
 * Skips validation in dev mode (when Cognito is not configured).
 */
function requireAuth(req, res, next) {
    if (!isCognitoEnabled()) {
        // Dev pass-through — attach a mock user so downstream code can rely on req.user
        req.user = { sub: 'dev-user', 'cognito:groups': ['RCIC'] };
        return next();
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Authorization token required' });
    }

    jwt.verify(token, getKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
        audience: CLIENT_ID,
    }, (err, decoded) => {
        if (err) {
            console.error('JWT verification failed:', err.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
}

/**
 * requireRole(...roles) — verifies that the authenticated user belongs to at
 * least one of the specified Cognito groups.
 *
 * Example: requireRole('RCIC', 'CaseOfficer')
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!isCognitoEnabled()) return next(); // Dev pass-through

        const userGroups = req.user?.['cognito:groups'] || [];
        const hasRole = roles.some(role => userGroups.includes(role));

        if (!hasRole) {
            return res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole, isCognitoEnabled };
