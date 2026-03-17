/**
 * One-time backfill script: Creates auto-tasks for existing clients
 * based on their current workflow state (PIF status, retainer agreements).
 *
 * Run once: node scripts/backfillTasks.js
 */

require('dotenv').config();
const { prepareAll, prepareGet, prepareRun } = require('../database');
const { createWorkflowTask } = require('../services/autoTaskService');

async function backfill() {
    console.log('🔄 Backfilling workflow tasks for existing clients...\n');

    const clients = await prepareAll('SELECT * FROM clients ORDER BY id');
    let created = 0;

    for (const c of clients) {
        const name = `${c.first_name} ${c.last_name}`;
        console.log(`--- Client ${c.id}: ${name} (PIF: ${c.pif_status}) ---`);

        // Check retainer agreement status
        const agreement = await prepareGet(
            'SELECT id, status FROM client_retainer_agreements WHERE client_id = ? ORDER BY generated_at DESC LIMIT 1',
            c.id
        );

        // 1. PIF-related tasks
        if (c.pif_status === 'pending') {
            // PIF hasn't been sent yet
            const t = await createWorkflowTask(c.id, { title: `Send PIF form to ${name}`, category: 'PIF', priority: 'high', dueDays: 1 });
            if (t.title) { console.log('  ✅ Created: Send PIF form'); created++; }
        } else if (c.pif_status === 'sent') {
            // PIF sent but not completed — create follow-up
            const t = await createWorkflowTask(c.id, { title: `Follow up on PIF submission — ${name}`, category: 'PIF', priority: 'medium', dueDays: 7 });
            if (t.title) { console.log('  ✅ Created: Follow up on PIF submission'); created++; }
        }
        // If pif_status = 'completed', no PIF tasks needed

        // 2. Retainer agreement tasks
        if (!agreement) {
            // No agreement generated yet
            const t = await createWorkflowTask(c.id, { title: `Generate retainer agreement for ${name}`, category: 'Client Follow-up', priority: 'medium', dueDays: 3 });
            if (t.title) { console.log('  ✅ Created: Generate retainer agreement'); created++; }
        } else if (agreement.status === 'draft') {
            // Agreement generated but not sent for signing
            const t = await createWorkflowTask(c.id, { title: `Send retainer agreement for signing — ${name}`, category: 'Client Follow-up', priority: 'high', dueDays: 1 });
            if (t.title) { console.log('  ✅ Created: Send retainer agreement for signing'); created++; }
        } else if (agreement.status === 'sent') {
            // Sent but not signed
            const t = await createWorkflowTask(c.id, { title: `Follow up on retainer agreement signing — ${name}`, category: 'Client Follow-up', priority: 'medium', dueDays: 7 });
            if (t.title) { console.log('  ✅ Created: Follow up on retainer agreement signing'); created++; }
        }
        // If status = 'signed', no retainer tasks needed
    }

    console.log(`\n✅ Backfill complete. Created ${created} new tasks + follow-up deadlines.`);
    process.exit(0);
}

backfill().catch(err => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
});
