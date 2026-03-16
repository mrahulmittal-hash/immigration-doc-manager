const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/notifications
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await prepareAll(
      `SELECT * FROM notifications WHERE is_dismissed = false
       ORDER BY is_read ASC, trigger_date DESC, created_at DESC LIMIT 50`
    );
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/count
router.get('/notifications/count', async (req, res) => {
  try {
    const result = await prepareGet(
      'SELECT COUNT(*) as count FROM notifications WHERE is_read = false AND is_dismissed = false'
    );
    res.json({ count: parseInt(result?.count || 0) });
  } catch (err) {
    console.error('Error fetching notification count:', err);
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// POST /api/notifications/generate - Generate notifications from deadlines, birthdays, anniversaries
router.post('/notifications/generate', async (req, res) => {
  try {
    let generated = 0;

    // 1. Deadline reminders - deadlines coming up within their reminder_days window
    const deadlines = await prepareAll(
      `SELECT d.*, c.first_name, c.last_name FROM client_deadlines d
       JOIN clients c ON c.id = d.client_id
       WHERE d.status = 'pending' AND d.deadline_date <= CURRENT_DATE + d.reminder_days
       AND d.deadline_date >= CURRENT_DATE - 7`
    );
    for (const dl of deadlines) {
      const exists = await prepareGet(
        `SELECT id FROM notifications WHERE type = 'deadline_reminder' AND reference_type = 'deadline' AND reference_id = ? AND trigger_date = CURRENT_DATE`,
        dl.id
      );
      if (!exists) {
        const daysLeft = Math.ceil((new Date(dl.deadline_date) - new Date()) / (1000 * 60 * 60 * 24));
        await prepareRun(
          `INSERT INTO notifications (type, title, message, reference_type, reference_id, trigger_date)
           VALUES (?, ?, ?, ?, ?, CURRENT_DATE)`,
          'deadline_reminder',
          daysLeft <= 0 ? `OVERDUE: ${dl.title}` : `Deadline in ${daysLeft} day(s): ${dl.title}`,
          `${dl.first_name} ${dl.last_name} — ${dl.category || 'General'}`,
          'deadline', dl.id
        );
        generated++;
      }
    }

    // 2. Birthdays this week
    const birthdays = await prepareAll(
      `SELECT id, first_name, last_name, date_of_birth FROM clients
       WHERE status = 'active' AND date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM date_of_birth::date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM date_of_birth::date) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM CURRENT_DATE) + 7`
    );
    for (const cl of birthdays) {
      const exists = await prepareGet(
        `SELECT id FROM notifications WHERE type = 'birthday' AND reference_id = ? AND trigger_date = CURRENT_DATE`,
        cl.id
      );
      if (!exists) {
        const age = new Date().getFullYear() - new Date(cl.date_of_birth).getFullYear();
        await prepareRun(
          `INSERT INTO notifications (type, title, message, reference_type, reference_id, trigger_date)
           VALUES (?, ?, ?, ?, ?, CURRENT_DATE)`,
          'birthday',
          `Birthday: ${cl.first_name} ${cl.last_name}`,
          `Turning ${age} — send birthday wishes!`,
          'client', cl.id
        );
        generated++;
      }
    }

    // 3. Approval anniversaries this week
    const anniversaries = await prepareAll(
      `SELECT id, first_name, last_name, approved_date FROM clients
       WHERE approved_date IS NOT NULL
       AND EXTRACT(MONTH FROM approved_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM approved_date) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM CURRENT_DATE) + 7`
    );
    for (const cl of anniversaries) {
      const exists = await prepareGet(
        `SELECT id FROM notifications WHERE type = 'anniversary' AND reference_id = ? AND trigger_date = CURRENT_DATE`,
        cl.id
      );
      if (!exists) {
        const years = new Date().getFullYear() - new Date(cl.approved_date).getFullYear();
        await prepareRun(
          `INSERT INTO notifications (type, title, message, reference_type, reference_id, trigger_date)
           VALUES (?, ?, ?, ?, ?, CURRENT_DATE)`,
          'anniversary',
          `Anniversary: ${cl.first_name} ${cl.last_name}`,
          `${years} year(s) since case approval`,
          'client', cl.id
        );
        generated++;
      }
    }

    // 4. Overdue tasks
    const overdueTasks = await prepareAll(
      `SELECT t.*, c.first_name, c.last_name FROM tasks t
       LEFT JOIN clients c ON c.id = t.client_id
       WHERE t.done = false AND t.due_date < CURRENT_DATE`
    );
    for (const task of overdueTasks) {
      const exists = await prepareGet(
        `SELECT id FROM notifications WHERE type = 'task_due' AND reference_id = ? AND trigger_date = CURRENT_DATE`,
        task.id
      );
      if (!exists) {
        await prepareRun(
          `INSERT INTO notifications (type, title, message, reference_type, reference_id, trigger_date)
           VALUES (?, ?, ?, ?, ?, CURRENT_DATE)`,
          'task_due',
          `Overdue Task: ${task.title}`,
          task.first_name ? `${task.first_name} ${task.last_name}` : 'No client assigned',
          'task', task.id
        );
        generated++;
      }
    }

    res.json({ generated, message: `Generated ${generated} new notifications` });
  } catch (err) {
    console.error('Error generating notifications:', err);
    res.status(500).json({ error: 'Failed to generate notifications' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    await prepareRun('UPDATE notifications SET is_read = true WHERE id = ?', parseInt(req.params.id));
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/notifications/read-all', async (req, res) => {
  try {
    await prepareRun('UPDATE notifications SET is_read = true WHERE is_read = false');
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/:id
router.delete('/notifications/:id', async (req, res) => {
  try {
    await prepareRun('UPDATE notifications SET is_dismissed = true WHERE id = ?', parseInt(req.params.id));
    res.json({ message: 'Notification dismissed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});

module.exports = router;
