import { useState, useEffect, useCallback } from 'react';
import { Newspaper, RefreshCw, ExternalLink, Filter, FileText, Globe, BookOpen, Clock, AlertCircle, ArrowRight, Scale, Plane, GraduationCap, Briefcase, Users, Heart } from 'lucide-react';
import { api } from '../api';

/* ═══════════════════════════════════════════════════════════
   IRCC Quick Links — Forms, Tools, Resources
   ═══════════════════════════════════════════════════════════ */
const IRCC_LINKS = [
  {
    section: 'Key IRCC Pages',
    items: [
      { title: 'IRCC Newsroom', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/news.html', icon: Newspaper, desc: 'Official news releases and statements' },
      { title: 'Operational Notices', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices.html', icon: AlertCircle, desc: 'Service disruptions and operational updates' },
      { title: 'Check Processing Times', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html', icon: Clock, desc: 'Current processing times for all applications' },
      { title: 'Check Application Status', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-status.html', icon: Globe, desc: 'Track the status of submitted applications' },
    ],
  },
  {
    section: 'Forms & Guides',
    items: [
      { title: 'All Application Forms & Guides', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html', icon: FileText, desc: 'Complete list of IRCC forms' },
      { title: 'Express Entry — IMM 0008', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-permanent-residence-federal-skilled-workers.html', icon: Scale, desc: 'Federal Skilled Worker / CEC / FST application' },
      { title: 'Study Permit — IMM 1294', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-study-permit-outside-canada.html', icon: GraduationCap, desc: 'Study permit application form & guide' },
      { title: 'Work Permit — IMM 1295', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-work-permit-outside-canada.html', icon: Briefcase, desc: 'Work permit application form & guide' },
      { title: 'Visitor Visa (TRV) — IMM 5257', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-visitor-visa-temporary-resident-visa.html', icon: Plane, desc: 'Temporary resident visa application' },
      { title: 'Spousal Sponsorship — IMM 1344', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-sponsor-spouse-common-law-partner-conjugal-partner-dependent-child.html', icon: Heart, desc: 'Sponsor your spouse or partner' },
      { title: 'Family Sponsorship — IMM 1344', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-sponsor-parents-grandparents.html', icon: Users, desc: 'Parent and grandparent sponsorship' },
    ],
  },
  {
    section: 'Tools & Resources',
    items: [
      { title: 'CRS Score Calculator', url: 'https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp', icon: Scale, desc: 'Calculate your Comprehensive Ranking System score' },
      { title: 'Come to Canada Tool', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/come-canada-tool.html', icon: Globe, desc: 'Find out which programs you may be eligible for' },
      { title: 'Find a Representative', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigration-citizenship-representative/choose.html', icon: Users, desc: 'How to choose an authorized representative' },
      { title: 'Document Checklist Tool', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html', icon: BookOpen, desc: 'Get a personalized document checklist' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   Category Config
   ═══════════════════════════════════════════════════════════ */
const CATEGORIES = [
  { key: null,                 label: 'All' },
  { key: 'express_entry',     label: 'Express Entry' },
  { key: 'study_permit',      label: 'Study Permit' },
  { key: 'work_permit',       label: 'Work Permit' },
  { key: 'pnp',               label: 'PNP' },
  { key: 'family_sponsorship', label: 'Family' },
  { key: 'draw_results',      label: 'Draws' },
  { key: 'processing_times',  label: 'Processing' },
  { key: 'policy_change',     label: 'Policy' },
  { key: 'general',           label: 'General' },
];

function categoryLabel(key) {
  return CATEGORIES.find(c => c.key === key)?.label || key || 'General';
}

const CAT_COLORS = {
  express_entry:     { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  study_permit:      { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  work_permit:       { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  pnp:               { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
  family_sponsorship: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  refugee:           { bg: '#f5f5f4', text: '#44403c', border: '#d6d3d1' },
  draw_results:      { bg: '#ecfeff', text: '#155e75', border: '#a5f3fc' },
  processing_times:  { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
  policy_change:     { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' },
  general:           { bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' },
};

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */
export default function ImmigrationUpdates() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [tab, setTab] = useState('updates'); // 'updates' | 'resources'

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getIRCCUpdates(activeCategory, 100);
      setUpdates(data);
    } catch (err) {
      console.error('Failed to fetch IRCC updates:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      await api.triggerIRCCScrape();
      await fetchUpdates();
    } catch (err) {
      console.error('Scrape failed:', err);
    } finally {
      setScraping(false);
    }
  };

  return (
    <div>
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="ircc-header">
        <div className="ircc-header-left">
          <div className="ircc-header-icon">
            <img src="https://www.canada.ca/etc/designs/canada/wet-boew/assets/favicon.ico" alt="" width={22} height={22} onError={e => { e.target.style.display = 'none'; }} />
          </div>
          <div>
            <h1 className="ircc-title">IRCC Immigration Hub</h1>
            <p className="ircc-subtitle">News, notices, forms & resources from Immigration, Refugees and Citizenship Canada</p>
          </div>
        </div>
        <div className="ircc-header-actions">
          <a href="https://www.canada.ca/en/immigration-refugees-citizenship.html" target="_blank" rel="noopener noreferrer" className="ircc-ext-link">
            <Globe size={14} /> Visit IRCC Website <ExternalLink size={12} />
          </a>
          <button onClick={handleScrape} disabled={scraping} className="ircc-refresh-btn">
            <RefreshCw size={15} className={scraping ? 'spin' : ''} />
            {scraping ? 'Scraping…' : 'Refresh News'}
          </button>
        </div>
      </div>

      {/* ── Tab Switch ───────────────────────────────────── */}
      <div className="ircc-tabs">
        <button className={`ircc-tab ${tab === 'updates' ? 'active' : ''}`} onClick={() => setTab('updates')}>
          <Newspaper size={15} /> News & Notices
          {updates.length > 0 && <span className="ircc-tab-count">{updates.length}</span>}
        </button>
        <button className={`ircc-tab ${tab === 'resources' ? 'active' : ''}`} onClick={() => setTab('resources')}>
          <BookOpen size={15} /> Forms & Resources
        </button>
      </div>

      {/* ════════════════════════════════════════════════════
         TAB: News & Notices
         ════════════════════════════════════════════════════ */}
      {tab === 'updates' && (
        <div>
          {/* Category pills */}
          <div className="ircc-filters">
            <Filter size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
            {CATEGORIES.map(cat => (
              <button
                key={cat.key || 'all'}
                onClick={() => setActiveCategory(cat.key)}
                className={`ircc-pill ${activeCategory === cat.key ? 'active' : ''}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Articles */}
          {loading ? (
            <div className="ircc-empty">
              <RefreshCw size={28} className="spin" />
              <p>Loading updates...</p>
            </div>
          ) : updates.length === 0 ? (
            <div className="ircc-empty">
              <Newspaper size={40} style={{ opacity: 0.25 }} />
              <h3>No updates found</h3>
              <p>Click "Refresh News" to scrape the latest IRCC articles, or try a different category filter.</p>
            </div>
          ) : (
            <div className="ircc-article-list">
              {updates.map(u => {
                const c = CAT_COLORS[u.category] || CAT_COLORS.general;
                return (
                  <a key={u.id} href={u.url} target="_blank" rel="noopener noreferrer" className="ircc-article">
                    <div className="ircc-article-top">
                      <span className="ircc-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                        {categoryLabel(u.category)}
                      </span>
                      {u.published_date && <span className="ircc-date">{new Date(u.published_date + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
                      <ExternalLink size={13} className="ircc-article-ext" />
                    </div>
                    <h3 className="ircc-article-title">{u.title}</h3>
                    {u.summary && u.summary !== u.title && (
                      <p className="ircc-article-summary">{u.summary}</p>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
         TAB: Forms & Resources
         ════════════════════════════════════════════════════ */}
      {tab === 'resources' && (
        <div className="ircc-resources">
          {IRCC_LINKS.map(section => (
            <div key={section.section} className="ircc-resource-section">
              <h2 className="ircc-section-heading">{section.section}</h2>
              <div className="ircc-link-grid">
                {section.items.map(item => (
                  <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="ircc-link-card">
                    <div className="ircc-link-icon">
                      <item.icon size={18} />
                    </div>
                    <div className="ircc-link-info">
                      <div className="ircc-link-title">{item.title}</div>
                      <div className="ircc-link-desc">{item.desc}</div>
                    </div>
                    <ArrowRight size={14} className="ircc-link-arrow" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
