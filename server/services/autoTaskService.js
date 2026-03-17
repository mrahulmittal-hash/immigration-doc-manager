/**
 * autoTaskService.js — Auto-creates workflow tasks and follow-up deadlines
 *
 * When workflow events happen (PIF sent, agreement generated, etc.),
 * this service creates corresponding tasks and calendar follow-ups.
 */

const { prepareAll, prepareGet, prepareRun } = require('../database');

/**
 * Create a workflow task for a client, with an optional follow-up deadline.
 * Prevents duplicates by checking for existing pending tasks with the same title pattern.
 *
 * @param {number} clientId
 * @param {object} opts
 * @param {string} opts.title — Task title
 * @param {string} opts.category — Task category (PIF, Client Follow-up, etc.)
 * @param {string} opts.priority — high | medium | low
 * @param {number} opts.dueDays — Days from now for task due date
 * @param {boolean} [opts.createFollowUp=true] — Whether to also create a calendar deadline
 * @param {number} [opts.followUpDays=7] — Days after due date for the follow-up deadline
 * @returns {object} The created task (or existing duplicate)
 */
async function createWorkflowTask(clientId, { title, category = 'Client Follow-up', priority = 'medium', dueDays = 7, createFollowUp = true, followUpDays = 7 }) {
    // Check for existing pending task with same title for this client
    const existing = await prepareGet(
        'SELECT id FROM tasks WHERE client_id = ? AND title = ? AND done = false',
        clientId, title
    );
    if (existing) return existing;

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Create the task
    const result = await prepareRun(
        'INSERT INTO tasks (client_id, title, priority, category, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        clientId, title, priority, category, dueDateStr, 'System'
    );

    // Create follow-up deadline in calendar
    if (createFollowUp) {
        const followUpDate = new Date(dueDate);
        followUpDate.setDate(followUpDate.getDate() + followUpDays);
        const followUpDateStr = followUpDate.toISOString().split('T')[0];

        // Check for existing follow-up deadline
        const existingDeadline = await prepareGet(
            'SELECT id FROM client_deadlines WHERE client_id = ? AND title = ? AND status = ?',
            clientId, `Follow up: ${title}`, 'pending'
        );

        if (!existingDeadline) {
            await prepareRun(
                'INSERT INTO client_deadlines (client_id, title, deadline_date, category, reminder_days) VALUES (?, ?, ?, ?, ?)',
                clientId, `Follow up: ${title}`, followUpDateStr, 'consultation', 3
            );
        }
    }

    return { id: result.lastInsertRowid, title, due_date: dueDateStr };
}

/**
 * Mark workflow tasks as done by title pattern match.
 * Also marks associated follow-up deadlines as completed.
 *
 * @param {number} clientId
 * @param {string} titlePattern — Exact title or SQL LIKE pattern
 * @param {boolean} [useLike=false] — Use LIKE matching instead of exact match
 */
async function completeWorkflowTask(clientId, titlePattern, useLike = false) {
    const now = new Date().toISOString();

    if (useLike) {
        await prepareRun(
            'UPDATE tasks SET done = true, completed_at = ? WHERE client_id = ? AND title LIKE ? AND done = false',
            now, clientId, titlePattern
        );
        await prepareRun(
            "UPDATE client_deadlines SET status = 'completed' WHERE client_id = ? AND title LIKE ? AND status = 'pending'",
            clientId, `Follow up: ${titlePattern}`
        );
    } else {
        await prepareRun(
            'UPDATE tasks SET done = true, completed_at = ? WHERE client_id = ? AND title = ? AND done = false',
            now, clientId, titlePattern
        );
        await prepareRun(
            "UPDATE client_deadlines SET status = 'completed' WHERE client_id = ? AND title = ? AND status = 'pending'",
            clientId, `Follow up: ${titlePattern}`
        );
    }
}

module.exports = { createWorkflowTask, completeWorkflowTask };
