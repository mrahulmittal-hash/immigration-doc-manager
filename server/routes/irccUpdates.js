const express = require('express');
const router = express.Router();
const { prepareAll } = require('../database');
const { scrapeIRCCNews } = require('../services/irccAgent');

// GET /api/ircc-updates — list updates with optional category filter and limit
router.get('/ircc-updates', async (req, res) => {
  try {
    const { category, limit } = req.query;
    const maxRows = Math.min(parseInt(limit) || 50, 200);

    let rows;
    if (category) {
      rows = await prepareAll(
        'SELECT * FROM ircc_updates WHERE category = ? ORDER BY published_date DESC NULLS LAST, scraped_at DESC LIMIT ?',
        category,
        maxRows
      );
    } else {
      rows = await prepareAll(
        'SELECT * FROM ircc_updates ORDER BY published_date DESC NULLS LAST, scraped_at DESC LIMIT ?',
        maxRows
      );
    }

    res.json(rows);
  } catch (err) {
    console.error('Error fetching IRCC updates:', err);
    res.status(500).json({ error: 'Failed to fetch IRCC updates' });
  }
});

// POST /api/ircc-updates/scrape — trigger a manual scrape
router.post('/ircc-updates/scrape', async (req, res) => {
  try {
    const result = await scrapeIRCCNews();
    res.json({ message: 'Scrape completed', ...result });
  } catch (err) {
    console.error('Error during IRCC scrape:', err);
    res.status(500).json({ error: 'Scrape failed: ' + err.message });
  }
});

module.exports = router;
