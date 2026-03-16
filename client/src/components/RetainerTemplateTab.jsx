import { useState, useEffect } from 'react';
import { FileText, Save, Eye, X, Info } from 'lucide-react';
import { api } from '../api';

const TOKENS = [
  { token: '{{client_name}}', desc: 'Client full name' },
  { token: '{{client_dob}}', desc: 'Date of birth' },
  { token: '{{client_phone}}', desc: 'Client phone' },
  { token: '{{client_email}}', desc: 'Client email' },
  { token: '{{client_nationality}}', desc: 'Nationality' },
  { token: '{{service_type}}', desc: 'Immigration service' },
  { token: '{{professional_fee}}', desc: 'Base professional fee' },
  { token: '{{gst_rate}}', desc: 'GST rate %' },
  { token: '{{gst_amount}}', desc: 'GST dollar amount' },
  { token: '{{total_fee}}', desc: 'Grand total incl. GST' },
  { token: '{{fee_adjustments}}', desc: 'Discount/waiver details' },
  { token: '{{rcic_name}}', desc: 'RCIC consultant name' },
  { token: '{{rcic_license}}', desc: 'RCIC license number' },
  { token: '{{firm_name}}', desc: 'Business name' },
  { token: '{{firm_address}}', desc: 'Firm address' },
  { token: '{{firm_phone}}', desc: 'Firm phone' },
  { token: '{{firm_email}}', desc: 'Firm email' },
  { token: '{{province}}', desc: 'Province' },
  { token: '{{date}}', desc: 'Current date' },
];

export default function RetainerTemplateTab() {
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { loadSections(); }, []);

  async function loadSections() {
    try {
      const rows = await api.getRetainerTemplate();
      setSections(rows);
      if (!selected && rows.length > 0) {
        setSelected(rows[0].section_number);
        setEditContent(rows[0].content);
        setEditTitle(rows[0].title);
      }
    } catch (err) { console.error(err); }
  }

  function handleSelectSection(sec) {
    setSelected(sec.section_number);
    setEditContent(sec.content);
    setEditTitle(sec.title);
    setMsg('');
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateRetainerTemplateSection(selected, { content: editContent, title: editTitle });
      setMsg('Section saved');
      await loadSections();
    } catch (err) { setMsg(err.message); }
    setSaving(false);
  }

  async function handlePreview() {
    try {
      const res = await api.previewRetainerTemplate();
      setPreviewHtml(res.html);
      setShowPreview(true);
    } catch (err) { setMsg('Preview failed: ' + err.message); }
  }

  function insertToken(token) {
    const ta = document.getElementById('template-editor');
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = editContent.substring(0, start) + token + editContent.substring(end);
    setEditContent(newVal);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length); }, 0);
  }

  const currentSection = sections.find(s => s.section_number === selected);

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 160px)', margin: '0 -32px -28px -32px' }}>
      {/* Left: Section list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', overflowY: 'auto', padding: '12px 0' }}>
        <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Template Sections</span>
          <button className="btn btn-primary" onClick={handlePreview} style={{ fontSize: 12, padding: '6px 12px' }}>
            <Eye size={14} /> Preview
          </button>
        </div>
        {sections.map(sec => (
          <div
            key={sec.section_number}
            onClick={() => handleSelectSection(sec)}
            style={{
              padding: '10px 16px', cursor: 'pointer', borderLeft: '3px solid transparent',
              ...(selected === sec.section_number ? { background: 'var(--primary-glow)', borderLeftColor: 'var(--primary)' } : {}),
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {sec.section_number}. {sec.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sec.content.substring(0, 80)}...
            </div>
          </div>
        ))}
      </div>

      {/* Center: Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {currentSection ? (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  <FileText size={16} style={{ verticalAlign: 'middle' }} /> Section {selected}
                </h3>
                {msg && <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>{msg}</span>}
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Section'}
              </button>
            </div>
            <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Section Title</label>
                <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label className="form-label">Content</label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <Info size={12} style={{ verticalAlign: 'middle' }} /> Click a token below to insert at cursor position. Use newlines for paragraphs and "- " prefix for bullet items.
                </div>
              </div>
              <textarea
                id="template-editor"
                className="form-textarea"
                rows={18}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}
              />
            </div>
          </>
        ) : (
          <div className="empty" style={{ marginTop: 100 }}>
            <FileText size={48} style={{ color: 'var(--text-muted)' }} />
            <p>Select a section to edit</p>
          </div>
        )}
      </div>

      {/* Right: Token reference */}
      <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', overflowY: 'auto', padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>PLACEHOLDER TOKENS</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Click to insert at cursor position in editor</div>
        {TOKENS.map(t => (
          <div
            key={t.token}
            onClick={() => insertToken(t.token)}
            style={{
              padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
              background: 'var(--bg-subtle)', transition: 'background 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--primary-glow)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
          >
            <code style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{t.token}</code>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '90%', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>Retainer Agreement Preview</h3>
              <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
              <div style={{ background: '#fff', padding: 40, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
