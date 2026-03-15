import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ExternalLink, ArrowRight } from 'lucide-react';
import { api } from '../api';

export default function IRCCWidget() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getIRCCUpdates(null, 3)
      .then(data => setUpdates(data))
      .catch(err => console.error('Failed to load IRCC widget:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      background: 'var(--bg-surface, #fff)',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Newspaper size={18} style={{ color: 'var(--accent, #2563eb)' }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #1a1a2e)' }}>
            IRCC Updates
          </h3>
        </div>
        <Link
          to="/ircc-updates"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.78rem',
            color: 'var(--accent, #2563eb)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          View all <ArrowRight size={14} />
        </Link>
      </div>

      {loading ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
          Loading...
        </p>
      ) : updates.length === 0 ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
          No updates yet. Visit the IRCC Updates page to scrape the latest news.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {updates.map(update => (
            <a
              key={update.id}
              href={update.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border, #e2e8f0)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  color: 'var(--text-primary, #1a1a2e)',
                  lineHeight: 1.4,
                  marginBottom: '2px',
                }}>
                  {update.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                  {update.published_date || new Date(update.scraped_at).toLocaleDateString()}
                </div>
              </div>
              <ExternalLink size={14} style={{ flexShrink: 0, color: 'var(--text-muted, #64748b)', marginTop: '2px' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
