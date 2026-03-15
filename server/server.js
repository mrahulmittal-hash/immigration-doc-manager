require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, prepareAll, prepareGet } = require('./database');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes
const clientsRouter = require('./routes/clients');
const documentsRouter = require('./routes/documents');
const formsRouter = require('./routes/forms');
const clientDataRouter = require('./routes/clientData');
const pifRouter = require('./routes/pif');
const usersRouter = require('./routes/users');

// Mount routes
// Staff-facing routes protected by requireAuth (Cognito JWT or dev pass-through)
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api', requireAuth, documentsRouter);
app.use('/api', requireAuth, formsRouter);
app.use('/api', requireAuth, clientDataRouter);
app.use('/api/users', requireAuth, usersRouter);
// PIF routes are PUBLIC (magic-link flow — no Cognito login required for clients)
app.use('/api/pif', pifRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Dashboard stats
app.get('/api/stats', async (req, res) => {
    try {
        const [clientCount, docCount, formCount, filledCount, clientUploadCount, recentClients] = await Promise.all([
            prepareGet('SELECT COUNT(*) as count FROM clients'),
            prepareGet('SELECT COUNT(*) as count FROM documents'),
            prepareGet('SELECT COUNT(*) as count FROM forms'),
            prepareGet('SELECT COUNT(*) as count FROM filled_forms'),
            prepareGet("SELECT COUNT(*) as count FROM documents WHERE source = 'pif-upload'"),
            prepareAll('SELECT * FROM clients ORDER BY created_at DESC LIMIT 5'),
        ]);

        res.json({
            clients: parseInt(clientCount?.count || 0),
            documents: parseInt(docCount?.count || 0),
            forms: parseInt(formCount?.count || 0),
            filled_forms: parseInt(filledCount?.count || 0),
            client_uploads: parseInt(clientUploadCount?.count || 0),
            recent_clients: recentClients
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database (async) then start server
async function start() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`PropAgent API running on http://localhost:${PORT}`);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
