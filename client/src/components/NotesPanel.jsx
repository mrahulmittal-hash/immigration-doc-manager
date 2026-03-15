import { useState, useEffect } from 'react';
import { api } from '../api';
import { MessageSquare, Plus, Pin, Trash2, Edit3, Save, X } from 'lucide-react';

export default function NotesPanel({ clientId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const fetchNotes = () => {
    api.getNotes(clientId)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotes(); }, [clientId]);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setAdding(true);
    try {
      await api.addNote(clientId, newNote);
      setNewNote('');
      fetchNotes();
    } catch {}
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this note?')) return;
    await api.deleteNote(id);
    fetchNotes();
  };

  const handlePin = async (note) => {
    await api.updateNote(note.id, { is_pinned: !note.is_pinned });
    fetchNotes();
  };

  const handleSaveEdit = async (id) => {
    if (!editContent.trim()) return;
    await api.updateNote(id, { content: editContent });
    setEditingId(null);
    fetchNotes();
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      {/* Add note form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <textarea
            className="form-textarea"
            placeholder="Add a note about this client..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            rows={3}
            style={{ flex: 1, resize: 'vertical' }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd(); }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ctrl+Enter to submit</span>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={handleAdd} disabled={adding || !newNote.trim()}>
            <Plus size={14} /> Add Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><MessageSquare size={32} /></div>
            <div className="empty-title">No notes yet</div>
            <div className="empty-text">Add notes to keep track of important details about this client.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notes.map(note => (
            <div key={note.id} className="card" style={{
              padding: '16px 20px',
              borderLeft: note.is_pinned ? '3px solid var(--primary)' : '3px solid transparent',
            }}>
              {editingId === note.id ? (
                <div>
                  <textarea className="form-textarea" value={editContent}
                    onChange={e => setEditContent(e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}><X size={14} /> Cancel</button>
                    <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => handleSaveEdit(note.id)}><Save size={14} /> Save</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      {note.is_pinned && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-glow)',
                          padding: '2px 8px', borderRadius: 12, marginBottom: 8, display: 'inline-block' }}>
                          PINNED
                        </span>
                      )}
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {note.content}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-sm" title={note.is_pinned ? 'Unpin' : 'Pin'}
                        onClick={() => handlePin(note)}
                        style={{ color: note.is_pinned ? 'var(--primary)' : 'var(--text-muted)' }}>
                        <Pin size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" title="Edit"
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}>
                        <Edit3 size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" title="Delete"
                        style={{ color: '#ef4444' }} onClick={() => handleDelete(note.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>by {note.author || 'Admin'}</span>
                    <span>{new Date(note.created_at).toLocaleString()}</span>
                    {note.updated_at !== note.created_at && <span>(edited)</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
