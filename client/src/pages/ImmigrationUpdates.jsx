import { useState, useEffect, useCallback } from 'react';
import {
  Newspaper, RefreshCw, ExternalLink, FileText, Globe, BookOpen, Clock,
  AlertCircle, ArrowRight, Scale, Plane, GraduationCap, Briefcase, Users, Heart
} from 'lucide-react';
import { api } from '../api';

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
      { title: 'Express Entry — IMM 0008', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-permanent-residence-federal-skilled-workers.html', icon: Scale, desc: 'Federal Skilled Worker / CEC / FST' },
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
      { title: 'CRS Score Calculator', url: 'https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp', icon: Scale, desc: 'Calculate your CRS score' },
      { title: 'Come to Canada Tool', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/come-canada-tool.html', icon: Globe, desc: 'Find eligible programs' },
      { title: 'Find a Representative', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigration-citizenship-representative/choose.html', icon: Users, desc: 'Choose an authorized representative' },
      { title: 'Document Checklist Tool', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html', icon: BookOpen, desc: 'Personalized document checklist' },
    ],
  },
];

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

export default function ImmigrationUpdates() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [tab, setTab] = useState('updates');
  const [selectedArticle, setSelectedArticle] = useState(null);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getIRCCUpdates(activeCategory, 100);
      setUpdates(data);
    } catch (err) { console.error('Failed to fetch IRCC updates:', err); }
    finally { setLoading(false); }
  }, [activeCategory]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      await api.triggerIRCCScrape();
      await fetchUpdates();
    } catch (err) { console.error('Scrape failed:', err); }
    finally { setScraping(false); }
  };

  // Count articles per category
  const catCounts = {};
  updates.forEach(u => {
    const cat = u.category || 'general';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  return (
    <div className="clients-3panel">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="clients-sidebar">
        {/* Tab switch */}
        <div style={{ padding: '12px 12px 0', display: 'flex', gap: 4 }}>
          <button className={`clients-filter-chip ${tab === 'updates' ? 'active' : ''}`}
            onClick={() => setTab('updates')} style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Newspaper size={12} /> News
          </button>
          <button className={`clients-filter-chip ${tab === 'resources' ? 'active' : ''}`}
            onClick={() => setTab('resources')} style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={12} /> Resources
          </button>
        </div>

        {tab === 'updates' ? (
          <>
            {/* Category list */}
            <div className="clients-list" style={{ padding: '8px 0' }}>
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.key;
                const count = cat.key === null ? updates.length : (catCounts[cat.key] || 0);
                return (
                  <div key={cat.key || 'all'}
                    className={`clients-list-item ${isActive ? 'active' : ''}`}
                    onClick={() => { setActiveCategory(cat.key); setSelectedArticle(null); }}
                    style={{ padding: '10px 16px' }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: cat.key ? (CAT_COLORS[cat.key]?.text || '#6b7280') : '#0d9488' }} />
                    <div className="clients-item-info">
                      <div className="clients-item-name" style={{ fontSize: 12 }}>{cat.label}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 10 }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Resource sections in sidebar */
          <div className="clients-list" style={{ padding: '8px 0' }}>
            {IRCC_LINKS.map(section => (
              <div key={section.section}>
                <div style={{ padding: '12px 16px 4px', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.section}
                </div>
                {section.items.map(item => (
                  <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="clients-list-item" style={{ textDecoration: 'none', color: 'inherit', padding: '8px 16px' }}>
                    <item.icon size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <div className="clients-item-info">
                      <div className="clients-item-name" style={{ fontSize: 11 }}>{item.title}</div>
                    </div>
                    <ExternalLink size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Refresh button */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleScrape} disabled={scraping}
            className="btn btn-ghost btn-sm" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <RefreshCw size={14} className={scraping ? 'spin' : ''} />
            {scraping ? 'Scraping…' : 'Refresh News'}
          </button>
        </div>
      </div>

      {/* ═══ CENTER PANEL ═══ */}
      <div className="clients-center">
        <div className="clients-center-scroll">
          {tab === 'updates' ? (
            loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
                <RefreshCw size={28} className="spin" />
                <p style={{ marginTop: 12 }}>Loading updates...</p>
              </div>
            ) : updates.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
                <Newspaper size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No updates found</div>
                <div style={{ fontSize: 13 }}>Click "Refresh News" to scrape the latest IRCC articles</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {updates.map(u => {
                  const c = CAT_COLORS[u.category] || CAT_COLORS.general;
                  const isSelected = selectedArticle?.id === u.id;
                  return (
                    <div key={u.id}
                      className="clients-detail-card"
                      style={{
                        cursor: 'pointer', transition: 'all 0.15s',
                        border: isSelected ? '1px solid rgba(13,148,136,.3)' : undefined,
                        background: isSelected ? 'rgba(13,148,136,.02)' : undefined,
                      }}
                      onClick={() => setSelectedArticle(u)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                          {categoryLabel(u.category)}
                        </span>
                        {u.published_date && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(u.published_date + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        {u.title}
                      </h3>
                      {u.summary && u.summary !== u.title && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {u.summary}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Resources tab content */
            <div>
              {IRCC_LINKS.map(section => (
                <div key={section.section} style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>{section.section}</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {section.items.map(item => (
                      <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
                        className="clients-detail-card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12, padding: 16, cursor: 'pointer' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--primary)' }}>
                          <item.icon size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
                        </div>
                        <ExternalLink size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT CONTEXT PANEL ═══ */}
      <div className="clients-context">
        {/* Quick Stats */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">Quick Stats</div>
          <div className="clients-ctx-stat-row">
            <span>Total Articles</span>
            <strong>{updates.length}</strong>
          </div>
          <div className="clients-ctx-stat-row">
            <span>Categories</span>
            <strong>{Object.keys(catCounts).length}</strong>
          </div>
        </div>

        {/* Selected Article */}
        {selectedArticle && (
          <div className="clients-ctx-section">
            <div className="clients-ctx-label">Selected Article</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
              {selectedArticle.title}
            </div>
            {(() => {
              const c = CAT_COLORS[selectedArticle.category] || CAT_COLORS.general;
              return (
                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: c.bg, color: c.text, marginBottom: 8 }}>
                  {categoryLabel(selectedArticle.category)}
                </span>
              );
            })()}
            {selectedArticle.published_date && (
              <div className="clients-ctx-row">
                <Clock size={12} color="var(--text-muted)" />
                <span style={{ fontSize: 12 }}>
                  {new Date(selectedArticle.published_date + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
            {selectedArticle.summary && selectedArticle.summary !== selectedArticle.title && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
                {selectedArticle.summary}
              </p>
            )}
            {selectedArticle.url && (
              <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer"
                className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
                <ExternalLink size={12} /> Read Full Article
              </a>
            )}
          </div>
        )}

        {/* IRCC Quick Links */}
        <div className="clients-ctx-section">
          <div className="clients-ctx-label">IRCC Quick Links</div>
          {IRCC_LINKS[0].items.map(item => (
            <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
              className="clients-ctx-row" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
              <item.icon size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, flex: 1 }}>{item.title}</span>
              <ExternalLink size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
