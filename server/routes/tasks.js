const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/tasks - List all tasks
router.get('/tasks', async (req, res) => {
  try {
    const { filter, category, client_id } = req.query;
    let query = `SELECT t.*, c.first_name, c.last_name
                 FROM tasks t LEFT JOIN clients c ON c.id = t.client_id`;
    const conditions = [];
    const params = [];

    if (filter === 'todo') { conditions.push('t.done = false'); }
    if (filter === 'done') { conditions.push('t.done = true'); }
    if (category && category !== 'all') { conditions.push('t.category = ?'); params.push(category); }
    if (client_id) { conditions.push('t.client_id = ?'); params.push(parseInt(client_id)); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.done ASC, t.due_date ASC NULLS LAST, t.created_at DESC';

    const tasks = await prepareAll(query, ...params);
    res.json(tasks.map(t => ({
      ...t,
      client: t.first_name ? `${t.first_name} ${t.last_name}` : null,
    })));
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/today - Tasks due within 7 days
router.get('/tasks/today', async (req, res) => {
  try {
    const tasks = await prepareAll(
      `SELECT t.*, c.first_name, c.last_name
       FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
       WHERE t.done = false AND t.due_date <= CURRENT_DATE + 7
       ORDER BY t.due_date ASC NULLS LAST, t.priority DESC`
    );
    res.json(tasks.map(t => ({
      ...t,
      client: t.first_name ? `${t.first_name} ${t.last_name}` : null,
    })));
  } catch (err) {
    console.error('Error fetching today tasks:', err);
    res.status(500).json({ error: 'Failed to fetch today tasks' });
  }
});

// GET /api/dashboard/today - Dashboard data (tasks, birthdays, anniversaries, deadlines)
router.get('/dashboard/today', async (req, res) => {
  try {
    const tasks = await prepareAll(
      `SELECT t.*, c.first_name, c.last_name
       FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
       WHERE t.done = false AND t.due_date <= CURRENT_DATE + 7
       ORDER BY t.due_date ASC NULLS LAST`
    );

    const birthdays = await prepareAll(
      `SELECT id, first_name, last_name, date_of_birth,
              EXTRACT(YEAR FROM AGE(date_of_birth::date))::int AS age
       FROM clients
       WHERE date_of_birth IS NOT NULL
         AND EXTRACT(MONTH FROM date_of_birth::date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM date_of_birth::date) = EXTRACT(DAY FROM CURRENT_DATE)`
    ).catch(() => []);

    const anniversaries = await prepareAll(
      `SELECT id, first_name, last_name, created_at,
              EXTRACT(YEAR FROM AGE(created_at::date))::int AS years
       FROM clients
       WHERE EXTRACT(MONTH FROM created_at::date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM created_at::date) = EXTRACT(DAY FROM CURRENT_DATE)
         AND created_at::date < CURRENT_DATE`
    ).catch(() => []);

    const deadlines = await prepareAll(
      `SELECT d.*, c.first_name, c.last_name
       FROM client_deadlines d LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.deadline_date <= CURRENT_DATE + 7
       ORDER BY d.deadline_date ASC`
    ).catch(() => []);

    res.json({
      tasks: tasks.map(t => ({ ...t, client: t.first_name ? `${t.first_name} ${t.last_name}` : null })),
      birthdays,
      anniversaries,
      deadlines,
    });
  } catch (err) {
    console.error('Error fetching dashboard today:', err);
    res.json({ tasks: [], birthdays: [], anniversaries: [], deadlines: [] });
  }
});

// POST /api/tasks
router.post('/tasks', async (req, res) => {
  try {
    const { title, priority, category, due_date, client_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await prepareRun(
      `INSERT INTO tasks (client_id, title, priority, category, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      client_id || null, title, priority || 'medium', category || 'Other', due_date || null, 'Admin'
    );

    const task = await prepareGet(
      `SELECT t.*, c.first_name, c.last_name FROM tasks t LEFT JOIN clients c ON c.id = t.client_id WHERE t.id = ?`,
      result.lastInsertRowid
    );
    res.status(201).json({ ...task, client: task.first_name ? `${task.first_name} ${task.last_name}` : null });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id
router.put('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, priority, category, due_date, client_id } = req.body;
    await prepareRun(
      `UPDATE tasks SET title = ?, priority = ?, category = ?, due_date = ?, client_id = ? WHERE id = ?`,
      title, priority, category, due_date || null, client_id || null, id
    );
    const task = await prepareGet('SELECT * FROM tasks WHERE id = ?', id);
    res.json(task);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:id/toggle
router.patch('/tasks/:id/toggle', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await prepareGet('SELECT * FROM tasks WHERE id = ?', id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const newDone = !task.done;
    await prepareRun(
      'UPDATE tasks SET done = ?, completed_at = ? WHERE id = ?',
      newDone, newDone ? new Date().toISOString() : null, id
    );
    const updated = await prepareGet('SELECT * FROM tasks WHERE id = ?', id);
    res.json(updated);
  } catch (err) {
    console.error('Error toggling task:', err);
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', async (req, res) => {
  try {
    await prepareRun('DELETE FROM tasks WHERE id = ?', parseInt(req.params.id));
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// GET /api/calendar/events — Combined tasks + deadlines for calendar view
router.get('/calendar/events', async (req, res) => {
  try {
    // Fetch all pending tasks with due dates
    const tasks = await prepareAll(
      `SELECT t.id, t.title, t.due_date, t.priority, t.category, t.done, t.client_id,
              c.first_name, c.last_name
       FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
       WHERE t.due_date IS NOT NULL
       ORDER BY t.due_date ASC`
    );

    // Fetch all deadlines
    const deadlines = await prepareAll(
      `SELECT d.id, d.title, d.deadline_date, d.category, d.status, d.client_id,
              c.first_name, c.last_name
       FROM client_deadlines d LEFT JOIN clients c ON c.id = d.client_id
       ORDER BY d.deadline_date ASC`
    );

    // Helper: normalize any date value to YYYY-MM-DD string
    function toDateStr(val) {
      if (!val) return null;
      const s = val.toString();
      // Already ISO format like "2026-03-18" or "2026-03-18T..."
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      // Full date string like "Fri Mar 20 2026 00:00:00 GM..."
      const d = new Date(s);
      if (isNaN(d)) return null;
      return d.toISOString().slice(0, 10);
    }

    // Map tasks to calendar events
    const taskEvents = tasks.map(t => ({
      id: `task-${t.id}`,
      date: toDateStr(t.due_date),
      label: t.title,
      type: t.done ? 'completed' : (t.priority === 'high' ? 'deadline' : 'reminder'),
      category: t.category,
      source: 'task',
      sourceId: t.id,
      done: t.done,
      client: t.first_name ? `${t.first_name} ${t.last_name}` : null,
      clientId: t.client_id,
    })).filter(e => e.date);

    // Map deadlines to calendar events
    const deadlineEvents = deadlines.map(d => ({
      id: `deadline-${d.id}`,
      date: toDateStr(d.deadline_date),
      label: d.title,
      type: d.status === 'completed' ? 'completed' : 'deadline',
      category: d.category,
      source: 'deadline',
      sourceId: d.id,
      done: d.status === 'completed',
      client: d.first_name ? `${d.first_name} ${d.last_name}` : null,
      clientId: d.client_id,
    })).filter(e => e.date);

    res.json([...taskEvents, ...deadlineEvents].sort((a, b) => a.date.localeCompare(b.date)));
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

module.exports = router;
