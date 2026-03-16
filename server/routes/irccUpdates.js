const express = require('express');
const router = express.Router();
const { prepareAll } = require('../database');
const { scrapeIRCCNews, scrapeIRCCUpdates } = require('../services/irccAgent');

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

// POST /api/ircc-updates/scrape-bulletins — scrape operational bulletins updates page
router.post('/ircc-updates/scrape-bulletins', async (req, res) => {
  try {
    const result = await scrapeIRCCUpdates();
    res.json({ message: 'Bulletin scrape completed', ...result });
  } catch (err) {
    console.error('Error during IRCC bulletin scrape:', err);
    res.status(500).json({ error: 'Bulletin scrape failed: ' + err.message });
  }
});

// POST /api/ircc-updates/scrape-all — scrape both notices and bulletins
router.post('/ircc-updates/scrape-all', async (req, res) => {
  try {
    const [notices, bulletins] = await Promise.allSettled([
      scrapeIRCCNews(),
      scrapeIRCCUpdates(),
    ]);
    res.json({
      message: 'Full scrape completed',
      notices: notices.status === 'fulfilled' ? notices.value : { error: notices.reason?.message },
      bulletins: bulletins.status === 'fulfilled' ? bulletins.value : { error: bulletins.reason?.message },
    });
  } catch (err) {
    console.error('Error during full IRCC scrape:', err);
    res.status(500).json({ error: 'Full scrape failed: ' + err.message });
  }
});

module.exports = router;
