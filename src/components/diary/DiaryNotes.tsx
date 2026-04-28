import React, { useState, useEffect, useMemo } from 'react';

interface NoteItem {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTE_COLORS = ['#1e293b', '#7c3aed22', '#3b82f622', '#10b98122', '#f59e0b22', '#ef444422', '#ec489922'];

export function DiaryNotes() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [search, setSearch] = useState('');
  const [editNote, setEditNote] = useState<NoteItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', color: NOTE_COLORS[0] });

  useEffect(() => {
    fetch('/api/get-app-data?key=diary_notes')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNotes(data); })
      .catch(() => {});
  }, []);

  const saveNotes = (updated: NoteItem[]) => {
    setNotes(updated);
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'diary_notes', data: updated }),
    });
  };

  const openNew = () => {
    setEditNote(null);
    setForm({ title: '', content: '', color: NOTE_COLORS[0] });
    setShowModal(true);
  };

  const openEdit = (note: NoteItem) => {
    setEditNote(note);
    setForm({ title: note.title, content: note.content, color: note.color });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.title.trim() && !form.content.trim()) return;
    const now = new Date().toISOString();
    if (editNote) {
      saveNotes(notes.map(n => n.id === editNote.id ? { ...n, ...form, updatedAt: now } : n));
    } else {
      const newNote: NoteItem = {
        id: Date.now().toString(),
        ...form,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      saveNotes([newNote, ...notes]);
    }
    setShowModal(false);
  };

  const deleteNote = (id: string) => {
    saveNotes(notes.filter(n => n.id !== id));
    setShowModal(false);
  };

  const togglePin = (id: string) => {
    saveNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const filtered = useMemo(() => {
    let result = [...notes];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    return result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, search]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อกี้';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} วันที่แล้ว`;
    return `${Math.floor(days / 30)} เดือนที่แล้ว`;
  };

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <input
            placeholder="🔍 ค้นหา notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...inputStyle,
              paddingLeft: 16,
            }}
          />
        </div>
        <button onClick={openNew} style={{
          padding: '10px 22px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff',
          cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
        }}>+ สร้าง Note</button>
      </div>

      {/* Notes Grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', paddingTop: 80, opacity: 0.3,
        }}>
          <span style={{ fontSize: '3rem' }}>📝</span>
          <p style={{ marginTop: 12, fontSize: '0.9rem' }}>{search ? 'ไม่พบผลลัพธ์' : 'ยังไม่มี notes — กดปุ่มเพื่อสร้าง'}</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(note => (
            <div
              key={note.id}
              onClick={() => openEdit(note)}
              style={{
                padding: 20,
                borderRadius: 18,
                border: '1px solid var(--border-color)',
                background: note.color.includes('#1e') ? 'var(--bg-card)' : note.color,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                minHeight: 140,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Pin badge */}
              {note.pinned && (
                <div style={{
                  position: 'absolute', top: 10, right: 10, fontSize: '0.85rem',
                }}>📌</div>
              )}
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 8 }}>
                {note.title || 'ไม่มีชื่อ'}
              </div>
              <div style={{
                fontSize: '0.82rem', opacity: 0.6, flex: 1,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 5, WebkitBoxOrient: 'vertical',
                lineHeight: 1.5,
              }}>
                {note.content}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border-color)',
              }}>
                <span style={{ fontSize: '0.68rem', opacity: 0.4 }}>{timeAgo(note.updatedAt)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin(note.id); }}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: '0.75rem', opacity: 0.4, color: 'var(--text-main)',
                  }}
                  title={note.pinned ? 'ยกเลิก Pin' : 'Pin'}
                >
                  {note.pinned ? '📌' : '📍'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)',
            borderRadius: 20, border: '1px solid var(--border-color)',
            padding: 28, width: 520, maxWidth: '90vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
          }}>
            <h3 style={{ margin: '0 0 16px', fontWeight: 700, fontSize: '1.1rem' }}>
              {editNote ? '✏️ แก้ไข Note' : '📝 สร้าง Note ใหม่'}
            </h3>
            <input
              placeholder="หัวข้อ..."
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={{ ...inputStyle, fontWeight: 700, fontSize: '1rem', marginBottom: 12 }}
            />
            <textarea
              placeholder="เขียนอะไรก็ได้..."
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={10}
              style={{ ...inputStyle, resize: 'vertical', flex: 1, marginBottom: 12, lineHeight: 1.6 }}
            />
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>สี</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {NOTE_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: c.includes('#1e') ? 'var(--bg-card)' : c,
                      cursor: 'pointer', border: form.color === c ? '3px solid var(--text-main)' : '3px solid var(--border-color)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {editNote && (
                <button onClick={() => deleteNote(editNote.id)} style={{
                  padding: '8px 18px', borderRadius: 10, border: '1px solid #ef4444',
                  background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600, marginRight: 'auto',
                }}>🗑️ ลบ</button>
              )}
              <button onClick={() => setShowModal(false)} style={{
                padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-color)',
                background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
              }}>ยกเลิก</button>
              <button onClick={handleSave} style={{
                padding: '8px 24px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff',
                cursor: 'pointer', fontWeight: 700,
              }}>💾 บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  border: '1px solid var(--border-color)', background: 'var(--bg-main)',
  color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: 4, display: 'block',
};
