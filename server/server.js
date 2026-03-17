require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, prepareAll, prepareGet } = require('./database');
const { requireAuth, requireRole } = require('./middleware/auth');

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
const timelineRouter = require('./routes/timeline');
const notesRouter = require('./routes/notes');
const irccRouter = require('./routes/irccUpdates');
const deadlinesRouter = require('./routes/deadlines');
const checklistsRouter = require('./routes/checklists');
const emailsRouter = require('./routes/emails');
const irccFormsRouter = require('./routes/irccForms');
const ocrRouter = require('./routes/ocr');
const signaturesRouter = require('./routes/signatures');
const signRouter = require('./routes/sign');
const portalRouter = require('./routes/portal');
const accountingRouter = require('./routes/accounting');
const tasksRouter = require('./routes/tasks');
const irccTemplatesRouter = require('./routes/ircc-templates');
const auditRouter = require('./routes/audit');
const adminRouter = require('./routes/admin');
const webhooksRouter = require('./routes/webhooks');

// Mount routes
// Staff-facing routes protected by requireAuth (JWT or dev pass-through)
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api', requireAuth, documentsRouter);
app.use('/api', requireAuth, formsRouter);
app.use('/api', requireAuth, clientDataRouter);
app.use('/api/users', usersRouter);  // login/refresh/register handled inside — protected routes use requireAuth internally
app.use('/api', requireAuth, timelineRouter);
app.use('/api', requireAuth, notesRouter);
app.use('/api', requireAuth, irccRouter);
app.use('/api', requireAuth, deadlinesRouter);
app.use('/api', requireAuth, checklistsRouter);
app.use('/api', requireAuth, emailsRouter);
app.use('/api', requireAuth, requireRole('Admin', 'RCIC Consultant'), irccFormsRouter);
app.use('/api', requireAuth, ocrRouter);
app.use('/api', requireAuth, signaturesRouter);
app.use('/api', requireAuth, accountingRouter);
app.use('/api', requireAuth, tasksRouter);
app.use('/api/ircc-templates', requireAuth, irccTemplatesRouter);
app.use('/api', requireAuth, auditRouter);
app.use('/api/admin', requireAuth, requireRole('Admin'), adminRouter);
app.use('/api', requireAuth, adminRouter);  // non-admin routes in admin.js (fee-adjustments, retainer-agreements, service-fees/active)
// PUBLIC routes (magic-link flow — no login required for clients)
app.use('/api/pif', pifRouter);
app.use('/api/sign', signRouter);
app.use('/api/portal', portalRouter);
app.use('/api/webhooks', webhooksRouter);  // DocuSign Connect callback (public, verified by HMAC)

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

// Dashboard Today endpoint
app.get('/api/dashboard/today', async (req, res) => {
    try {
        const [todayTasks, birthdays, upcomingDeadlines] = await Promise.all([
            // Tasks due today or overdue
            prepareAll(
                `SELECT t.*, c.first_name, c.last_name FROM tasks t
                 LEFT JOIN clients c ON c.id = t.client_id
                 WHERE t.done = false AND t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE + 7
                 ORDER BY t.due_date ASC, t.priority DESC LIMIT 10`
            ),
            // Birthdays this week (match month+day)
            prepareAll(
                `SELECT id, first_name, last_name, date_of_birth, visa_type FROM clients
                 WHERE status = 'active' AND date_of_birth IS NOT NULL
                 AND EXTRACT(MONTH FROM date_of_birth::date) = EXTRACT(MONTH FROM CURRENT_DATE)
                 AND EXTRACT(DAY FROM date_of_birth::date) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM CURRENT_DATE + 7)`
            ),
            // Critical deadlines (within 7 days)
            prepareAll(
                `SELECT d.*, c.first_name, c.last_name FROM client_deadlines d
                 JOIN clients c ON c.id = d.client_id
                 WHERE d.status = 'pending' AND d.deadline_date BETWEEN CURRENT_DATE - 3 AND CURRENT_DATE + 7
                 ORDER BY d.deadline_date ASC LIMIT 10`
            ),
        ]);

        // Anniversaries this week
        const anniversaries = await prepareAll(
            `SELECT id, first_name, last_name, approved_date, visa_type FROM clients
             WHERE approved_date IS NOT NULL
             AND EXTRACT(MONTH FROM approved_date) = EXTRACT(MONTH FROM CURRENT_DATE)
             AND EXTRACT(DAY FROM approved_date) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM CURRENT_DATE + 7)`
        );

        res.json({
            tasks: todayTasks.map(t => ({ ...t, client: t.first_name ? `${t.first_name} ${t.last_name}` : null })),
            birthdays: birthdays.map(b => ({ ...b, age: new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() })),
            anniversaries: anniversaries.map(a => ({ ...a, years: new Date().getFullYear() - new Date(a.approved_date).getFullYear() })),
            deadlines: upcomingDeadlines,
        });
    } catch (err) {
        console.error('Error fetching dashboard today:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
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

    const cron = require('node-cron');
    const { scrapeIRCCNews } = require('./services/irccAgent');
    // Scrape IRCC news daily at 8 AM
    cron.schedule('0 8 * * *', () => {
      console.log('Running scheduled IRCC news scrape...');
      scrapeIRCCNews().catch(err => console.error('Scheduled scrape failed:', err));
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
