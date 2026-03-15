const express = require('express');
const router = express.Router();
const { prepareAll, prepareGet, prepareRun } = require('../database');

// GET /api/tasks - List all tasks
router.get('/tasks', async (req, res) => {
  try {
    const { filter, category } = req.query;
    let query = `SELECT t.*, c.first_name, c.last_name
                 FROM tasks t LEFT JOIN clients c ON c.id = t.client_id`;
    const conditions = [];
    const params = [];

    if (filter === 'todo') { conditions.push('t.done = false'); }
    if (filter === 'done') { conditions.push('t.done = true'); }
    if (category && category !== 'all') { conditions.push('t.category = ?'); params.push(category); }

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

// GET /api/tasks/today - Tasks due today + overdue
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

module.exports = router;
