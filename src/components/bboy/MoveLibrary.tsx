import React, { useState, useEffect, useMemo } from 'react';

interface MoveItem {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  status: 'not_started' | 'learning' | 'mastered';
  videoUrl: string;
  notes: string;
  createdAt: string;
}

const MOVE_CATEGORIES = ['Toprock', 'Footwork', 'Power Moves', 'Freeze', 'Transitions', 'Flip/Acrobatic'];
const LEVELS: Record<string, { label: string; color: string }> = {
  beginner: { label: '🟢 เริ่มต้น', color: '#10b981' },
  intermediate: { label: '🟡 กลาง', color: '#f59e0b' },
  advanced: { label: '🔴 สูง', color: '#ef4444' },
};
const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  not_started: { label: 'ยังไม่แกะ', color: '#6b7280', emoji: '⬜' },
  learning: { label: 'กำลังฝึก', color: '#f59e0b', emoji: '🔄' },
  mastered: { label: 'ทำได้แล้ว', color: '#10b981', emoji: '✅' },
};

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function MoveLibrary() {
  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editMove, setEditMove] = useState<MoveItem | null>(null);
  const [form, setForm] = useState({
    name: '', category: 'Toprock', level: 'beginner' as MoveItem['level'],
    status: 'not_started' as MoveItem['status'], videoUrl: '', notes: '',
  });

  useEffect(() => {
    fetch('/api/get-app-data?key=bboy_moves')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMoves(data); })
      .catch(() => {});
  }, []);

  const saveMoves = (updated: MoveItem[]) => {
    setMoves(updated);
    fetch('/api/save-app-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'bboy_moves', data: updated }) });
  };

  const openAdd = () => {
    setEditMove(null);
    setForm({ name: '', category: 'Toprock', level: 'beginner', status: 'not_started', videoUrl: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (m: MoveItem) => {
    setEditMove(m);
    setForm({ name: m.name, category: m.category, level: m.level, status: m.status, videoUrl: m.videoUrl, notes: m.notes });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editMove) {
      saveMoves(moves.map(m => m.id === editMove.id ? { ...m, ...form } : m));
    } else {
      saveMoves([...moves, { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => { saveMoves(moves.filter(m => m.id !== id)); setShowModal(false); };

  const cycleStatus = (id: string) => {
    const order: MoveItem['status'][] = ['not_started', 'learning', 'mastered'];
    saveMoves(moves.map(m => {
      if (m.id !== id) return m;
      const nextIdx = (order.indexOf(m.status) + 1) % order.length;
      return { ...m, status: order[nextIdx] };
    }));
  };

  const filtered = useMemo(() => {
    return moves.filter(m => {
      if (filterCat !== 'all' && m.category !== filterCat) return false;
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      return true;
    });
  }, [moves, filterCat, filterStatus]);

  const stats = {
    total: moves.length,
    mastered: moves.filter(m => m.status === 'mastered').length,
    learning: moves.filter(m => m.status === 'learning').length,
  };

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'ทั้งหมด', value: stats.total, color: '#6366f1' },
          { label: 'กำลังฝึก', value: stats.learning, color: '#f59e0b' },
          { label: 'ทำได้แล้ว', value: stats.mastered, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '14px 24px', borderRadius: 16, border: '1px solid var(--border-color)',
            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={selectStyle}>
            <option value="all">ทุกหมวด</option>
            {MOVE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="all">ทุกสถานะ</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </div>
        <button onClick={openAdd} style={{
          padding: '10px 22px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff',
          cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
        }}>+ เพิ่มท่าเต้น</button>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, opacity: 0.3 }}>
          <span style={{ fontSize: '3rem' }}>🕺</span>
          <p>ยังไม่มีท่าเต้น — กดปุ่มเพื่อเพิ่ม</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(m => {
            const ytId = extractYoutubeId(m.videoUrl);
            const lv = LEVELS[m.level];
            const st = STATUS_CONFIG[m.status];
            return (
              <div key={m.id} style={{
                borderRadius: 18, border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}>
                {/* Video Preview */}
                {ytId ? (
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}`}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : m.videoUrl ? (
                  <div style={{
                    padding: 20, textAlign: 'center', background: 'var(--bg-main)',
                    fontSize: '0.8rem', opacity: 0.5,
                  }}>
                    <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>🔗 เปิดลิงก์</a>
                  </div>
                ) : (
                  <div style={{
                    height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-main)', fontSize: '2rem', opacity: 0.2,
                  }}>🎬</div>
                )}

                {/* Info */}
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{m.name}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6,
                          background: lv.color + '22', color: lv.color, fontWeight: 700,
                        }}>{lv.label}</span>
                        <span style={{
                          fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6,
                          background: 'var(--border-color)', opacity: 0.8,
                        }}>{m.category}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => cycleStatus(m.id)}
                      title="คลิกเพื่อเปลี่ยนสถานะ"
                      style={{
                        padding: '4px 10px', borderRadius: 8, border: `1px solid ${st.color}33`,
                        background: st.color + '18', color: st.color,
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem',
                      }}
                    >{st.emoji} {st.label}</button>
                  </div>
                  {m.notes && (
                    <div style={{ fontSize: '0.78rem', opacity: 0.5, marginTop: 4 }}>{m.notes}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => openEdit(m)} style={{
                      flex: 1, padding: '6px 0', borderRadius: 8,
                      border: '1px solid var(--border-color)', background: 'transparent',
                      color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.75rem',
                    }}>✏️ แก้ไข</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', borderRadius: 20,
            border: '1px solid var(--border-color)', padding: 28,
            width: 480, maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 700 }}>
              {editMove ? '✏️ แก้ไขท่าเต้น' : '🕺 เพิ่มท่าเต้นใหม่'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input placeholder="ชื่อท่า..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              <input placeholder="YouTube URL หรือ ลิงก์คลิป..." value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} style={inputStyle} />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>หมวด</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                    {MOVE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>ระดับ</label>
                  <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value as any })} style={inputStyle}>
                    {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <textarea placeholder="โน้ตการฝึก..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                {editMove && (
                  <button onClick={() => handleDelete(editMove.id)} style={deleteBtnStyle}>🗑️ ลบ</button>
                )}
                <button onClick={() => setShowModal(false)} style={cancelBtnStyle}>ยกเลิก</button>
                <button onClick={handleSave} style={saveBtnStyle}>💾 บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.82rem', outline: 'none' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: 4, display: 'block' };
const deleteBtnStyle: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600, marginRight: 'auto' };
const cancelBtnStyle: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { padding: '8px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700 };
