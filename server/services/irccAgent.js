const https = require('https');
const cheerio = require('cheerio');
const { prepareRun } = require('../database');

const NOTICES_URL = 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices.html';

const CATEGORY_KEYWORDS = {
  express_entry:      ['express entry', 'comprehensive ranking', 'crs', 'invitation to apply', 'economic immigration'],
  study_permit:       ['study permit', 'student visa', 'designated learning', 'post-graduation', 'international student'],
  work_permit:        ['work permit', 'lmia', 'open work permit', 'pgwp', 'labour market', 'temporary foreign worker'],
  pnp:               ['provincial nominee', 'pnp', 'bcpnp', 'oinp', 'sinp', 'mpnp', 'aainp'],
  family_sponsorship: ['family sponsorship', 'spousal', 'spouse', 'parent and grandparent', 'family reunification', 'family class'],
  refugee:           ['refugee', 'asylum', 'protected person', 'humanitarian', 'resettlement'],
  draw_results:      ['draw', 'round of invitations', 'invitations issued', 'draw results', 'candidates invited'],
  processing_times:  ['processing time', 'wait time', 'processing update', 'application processing', 'backlog'],
  policy_change:     ['policy', 'regulation', 'new rule', 'amendment', 'temporary public policy', 'pathway', 'new measures'],
};

function categorize(title) {
  const lower = (title || '').toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) return cat;
  }
  return 'general';
}

/** Fetch HTML using Node https module (Node fetch hangs on Canada.ca). */
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHTML(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/** Parse "March 10, 2026" or "1 November 2023" into YYYY-MM-DD. */
function parseDate(str) {
  if (!str) return null;
  const trimmed = str.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const d = new Date(trimmed);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Scrape IRCC notices page.
 * HTML: <li><a href="...">Title</a>&nbsp;<span class="label label-default">Date</span></li>
 */
async function scrapeIRCCNews() {
  console.log(`[IRCC Agent] Fetching ${NOTICES_URL} ...`);
  const html = await fetchHTML(NOTICES_URL);
  console.log(`[IRCC Agent] Got ${html.length} bytes`);

  const $ = cheerio.load(html);
  const articles = [];
  const seen = new Set();

  $('li').each((_, li) => {
    const $li = $(li);
    const $link = $li.find('a').first();
    const $date = $li.find('span.label').first();

    const href = ($link.attr('href') || '').trim();
    const rawTitle = $link.text().trim().replace(/\s+/g, ' ');
    const rawDate = $date.text().trim();

    if (rawTitle.length < 10 || !href.includes('/immigration-refugees-citizenship/') || seen.has(href)) return;
    seen.add(href);

    const fullUrl = href.startsWith('http') ? href : `https://www.canada.ca${href}`;
    const title = rawTitle.replace(/\s*[–—-]\s*archived$/i, '').trim();
    const summary = title.replace(/^Notice\s*[–—:-]\s*/i, '').trim() || null;

    articles.push({ title, url: fullUrl, category: categorize(title), publishedDate: parseDate(rawDate), summary });
  });

  console.log(`[IRCC Agent] Found ${articles.length} notices (${articles.filter(a => a.publishedDate).length} with dates)`);

  let inserted = 0;
  for (const a of articles) {
    try {
      const result = await prepareRun(
        `INSERT INTO ircc_updates (title, url, summary, category, published_date)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET
           summary = COALESCE(EXCLUDED.summary, ircc_updates.summary),
           published_date = COALESCE(EXCLUDED.published_date, ircc_updates.published_date),
           category = CASE WHEN ircc_updates.category = 'general' THEN EXCLUDED.category ELSE ircc_updates.category END`,
        a.title, a.url, a.summary, a.category, a.publishedDate
      );
      if (result.changes > 0) inserted++;
    } catch (err) {
      console.error(`[IRCC Agent] Insert failed: ${err.message}`);
    }
  }

  console.log(`[IRCC Agent] Done: ${inserted} upserted out of ${articles.length}`);
  return { inserted, total: articles.length };
}

module.exports = { scrapeIRCCNews };
