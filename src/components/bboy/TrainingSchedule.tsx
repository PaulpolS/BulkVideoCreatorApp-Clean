import React, { useState, useEffect } from 'react';

interface TrainingSession {
  id: string;
  dayOfWeek: number; // 0=Sun, 1=Mon...
  time: string;
  duration: number; // minutes
  category: string;
  moves: string;
  notes: string;
  completed: boolean;
}

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const CATEGORIES: { label: string; color: string; emoji: string }[] = [
  { label: 'Toprock', color: '#3b82f6', emoji: '🕺' },
  { label: 'Footwork', color: '#10b981', emoji: '👟' },
  { label: 'Power Moves', color: '#ef4444', emoji: '🔥' },
  { label: 'Freeze', color: '#8b5cf6', emoji: '🧊' },
  { label: 'Transitions', color: '#f59e0b', emoji: '🔄' },
  { label: 'Conditioning', color: '#ec4899', emoji: '💪' },
  { label: 'Stretch', color: '#06b6d4', emoji: '🧘' },
];

export function TrainingSchedule() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editSession, setEditSession] = useState<TrainingSession | null>(null);
  const [form, setForm] = useState({
    dayOfWeek: 1, time: '18:00', duration: 60, category: 'Toprock', moves: '', notes: '',
  });
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    fetch('/api/get-app-data?key=bboy_schedule')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSessions(data); })
      .catch(() => {});
  }, []);

  const saveSessions = (updated: TrainingSession[]) => {
    setSessions(updated);
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'bboy_schedule', data: updated }),
    });
  };

  const openAdd = (day: number) => {
    setEditSession(null);
    setForm({ dayOfWeek: day, time: '18:00', duration: 60, category: 'Toprock', moves: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (s: TrainingSession) => {
    setEditSession(s);
    setForm({ dayOfWeek: s.dayOfWeek, time: s.time, duration: s.duration, category: s.category, moves: s.moves, notes: s.notes });
    setShowModal(true);
  };

  const handleSave = () => {
    if (editSession) {
      saveSessions(sessions.map(s => s.id === editSession.id ? { ...s, ...form } : s));
    } else {
      saveSessions([...sessions, { id: Date.now().toString(), ...form, completed: false }]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    saveSessions(sessions.filter(s => s.id !== id));
    setShowModal(false);
  };

  const toggleComplete = (id: string) => {
    saveSessions(sessions.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const getCatConfig = (cat: string) => CATEGORIES.find(c => c.label === cat) || CATEGORIES[0];

  // Weekly stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.completed).length;
  const totalMinutes = sessions.filter(s => s.completed).reduce((a, s) => a + s.duration, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
      {/* Weekly Grid */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 20,
        border: '1px solid var(--border-color)', padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>📋 ตารางซ้อมรายสัปดาห์</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setWeekOffset(0)} style={{
              ...navBtnStyle,
              background: weekOffset === 0 ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'transparent',
              color: weekOffset === 0 ? '#fff' : 'var(--text-main)',
              border: weekOffset === 0 ? 'none' : '1px solid var(--border-color)',
              fontSize: '0.78rem', padding: '5px 12px',
            }}>สัปดาห์นี้</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 0].map(day => {
            const daySessions = sessions.filter(s => s.dayOfWeek === day);
            const today = new Date().getDay();
            const isToday = day === today;
            return (
              <div key={day} style={{
                borderRadius: 16,
                border: isToday ? '2px solid #ef4444' : '1px solid var(--border-color)',
                background: isToday ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                padding: 12,
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{
                  textAlign: 'center', marginBottom: 10,
                  fontWeight: 700, fontSize: '0.82rem',
                  color: isToday ? '#ef4444' : 'var(--text-main)',
                }}>
                  {DAYS_SHORT[day]}
                  {isToday && <span style={{ display: 'block', fontSize: '0.6rem', opacity: 0.6 }}>วันนี้</span>}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {daySessions.map(s => {
                    const cat = getCatConfig(s.category);
                    return (
                      <div
                        key={s.id}
                        onClick={() => openEdit(s)}
                        style={{
                          padding: 8, borderRadius: 10, cursor: 'pointer',
                          background: s.completed ? '#10b98118' : cat.color + '18',
                          border: `1px solid ${s.completed ? '#10b98133' : cat.color + '33'}`,
                          opacity: s.completed ? 0.6 : 1,
                          fontSize: '0.72rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700 }}>{cat.emoji} {s.category}</span>
                          <button
                            onClick={e => { e.stopPropagation(); toggleComplete(s.id); }}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              fontSize: '0.7rem', padding: 0,
                            }}
                          >{s.completed ? '✅' : '⬜'}</button>
                        </div>
                        <div style={{ opacity: 0.6, marginTop: 2 }}>
                          🕐 {s.time} · {s.duration}นาที
                        </div>
                        {s.moves && (
                          <div style={{ opacity: 0.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.moves}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => openAdd(day)}
                  style={{
                    marginTop: 8, width: '100%', padding: '6px 0',
                    borderRadius: 8, border: '1px dashed var(--border-color)',
                    background: 'transparent', cursor: 'pointer',
                    color: 'var(--text-main)', opacity: 0.3, fontSize: '0.75rem',
                  }}
                >+ เพิ่ม</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: 'linear-gradient(135deg, #ef4444, #f97316)',
          borderRadius: 20, padding: 24, color: '#fff',
        }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: 4 }}>🔥 สถิติสัปดาห์นี้</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: 4 }}>{completedSessions}/{totalSessions}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>เซสชันที่ทำเสร็จ</div>
          <div style={{
            height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.3)', marginTop: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3, background: '#fff',
              width: `${totalSessions > 0 ? (completedSessions / totalSessions * 100) : 0}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 20,
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700 }}>⏱️ เวลาซ้อม</h4>
          <div style={{ fontSize: '2rem', fontWeight: 900 }}>{totalMinutes}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>นาที ที่ซ้อมสัปดาห์นี้</div>
        </div>

        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 20,
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700 }}>📊 แยกตามหมวด</h4>
          {CATEGORIES.map(cat => {
            const count = sessions.filter(s => s.category === cat.label).length;
            if (count === 0) return null;
            return (
              <div key={cat.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid var(--border-color)',
                fontSize: '0.8rem',
              }}>
                <span>{cat.emoji} {cat.label}</span>
                <span style={{ fontWeight: 700, color: cat.color }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', borderRadius: 20,
            border: '1px solid var(--border-color)', padding: 28,
            width: 440, maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 700 }}>
              {editSession ? '✏️ แก้ไขเซสชัน' : '➕ เพิ่มเซสชันซ้อม'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>วัน</label>
                <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: Number(e.target.value) })} style={inputStyle}>
                  {[1, 2, 3, 4, 5, 6, 0].map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>เวลา</label>
                  <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>ระยะเวลา (นาที)</label>
                  <input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>หมวด</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.label} onClick={() => setForm({ ...form, category: cat.label })} style={{
                      padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: form.category === cat.label ? cat.color : cat.color + '22',
                      color: form.category === cat.label ? '#fff' : cat.color,
                      fontWeight: 600, fontSize: '0.78rem',
                      transition: 'all 0.15s ease',
                    }}>{cat.emoji} {cat.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>ท่าที่ต้องซ้อม</label>
                <input placeholder="เช่น Windmill, Headspin..." value={form.moves} onChange={e => setForm({ ...form, moves: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>หมายเหตุ</label>
                <textarea placeholder="โน้ตเพิ่มเติม..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                {editSession && (
                  <button onClick={() => handleDelete(editSession.id)} style={deleteBtnStyle}>🗑️ ลบ</button>
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

const navBtnStyle: React.CSSProperties = {
  borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  border: '1px solid var(--border-color)', background: 'var(--bg-main)',
  color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: 4, display: 'block' };
const deleteBtnStyle: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600, marginRight: 'auto' };
const cancelBtnStyle: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { padding: '8px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700 };
