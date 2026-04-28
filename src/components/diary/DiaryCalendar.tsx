import React, { useState, useEffect, useMemo } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  color: string;
  description: string;
}

const EVENT_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export function DiaryCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ title: '', startTime: '09:00', endTime: '10:00', color: EVENT_COLORS[0], description: '' });

  useEffect(() => {
    fetch('/api/get-app-data?key=diary_events')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEvents(data); })
      .catch(() => {});
  }, []);

  const saveEvents = (updated: CalendarEvent[]) => {
    setEvents(updated);
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'diary_events', data: updated }),
    });
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const openAddModal = (dateStr: string) => {
    setSelectedDate(dateStr);
    setEditEvent(null);
    setForm({ title: '', startTime: '09:00', endTime: '10:00', color: EVENT_COLORS[0], description: '' });
    setShowModal(true);
  };

  const openEditModal = (ev: CalendarEvent) => {
    setSelectedDate(ev.date);
    setEditEvent(ev);
    setForm({ title: ev.title, startTime: ev.startTime, endTime: ev.endTime, color: ev.color, description: ev.description });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.title.trim() || !selectedDate) return;
    if (editEvent) {
      const updated = events.map(e => e.id === editEvent.id ? { ...e, ...form, date: selectedDate } : e);
      saveEvents(updated);
    } else {
      const newEvent: CalendarEvent = { id: Date.now().toString(), ...form, date: selectedDate };
      saveEvents([...events, newEvent]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    saveEvents(events.filter(e => e.id !== id));
    setShowModal(false);
  };

  const selectedDateEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      {/* Calendar Grid */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 20,
        border: '1px solid var(--border-color)',
        padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} style={navBtnStyle}>←</button>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
              {MONTHS_TH[month]} {year + 543}
            </h3>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} style={navBtnStyle}>→</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setCurrentDate(new Date())} style={{
              ...navBtnStyle,
              padding: '6px 16px',
              fontSize: '0.8rem',
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              color: '#fff',
              border: 'none',
            }}>วันนี้</button>
            <button style={{
              ...navBtnStyle,
              padding: '6px 16px',
              fontSize: '0.8rem',
              opacity: 0.4,
            }} title="เชื่อมต่อ Google Calendar (เร็วๆ นี้)">
              🔗 Google Cal
            </button>
          </div>
        </div>

        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DAYS_TH.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              opacity: 0.4,
              padding: '8px 0',
              textTransform: 'uppercase',
            }}>{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {calendarDays.map((d, i) => {
            const isToday = d.dateStr === todayStr;
            const dayEvents = eventsByDate[d.dateStr] || [];
            const isSelected = d.dateStr === selectedDate;
            return (
              <div
                key={i}
                onClick={() => { setSelectedDate(d.dateStr); }}
                onDoubleClick={() => openAddModal(d.dateStr)}
                style={{
                  minHeight: 80,
                  padding: 6,
                  borderRadius: 12,
                  cursor: 'pointer',
                  opacity: d.isCurrentMonth ? 1 : 0.3,
                  background: isSelected ? 'rgba(245, 158, 11, 0.12)' : isToday ? 'rgba(245, 158, 11, 0.06)' : 'transparent',
                  border: isSelected ? '2px solid #f59e0b' : isToday ? '2px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: isToday ? 800 : 500,
                  color: isToday ? '#f59e0b' : 'var(--text-main)',
                  marginBottom: 4,
                }}>{d.day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayEvents.slice(0, 3).map(ev => (
                    <div key={ev.id} onClick={(e) => { e.stopPropagation(); openEditModal(ev); }} style={{
                      fontSize: '0.65rem',
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: ev.color + '22',
                      color: ev.color,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}>{ev.title}</div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: '0.6rem', opacity: 0.5, paddingLeft: 4 }}>+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel — Selected Day */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 20,
        border: '1px solid var(--border-color)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            {selectedDate ? formatDateThai(selectedDate) : 'เลือกวันที่'}
          </h4>
          {selectedDate && (
            <button onClick={() => openAddModal(selectedDate)} style={{
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}>+ เพิ่ม Event</button>
          )}
        </div>

        {selectedDateEvents.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '2.5rem' }}>📅</span>
            <span style={{ fontSize: '0.85rem' }}>ไม่มี event — ดับเบิ้ลคลิกวันที่เพื่อเพิ่ม</span>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {selectedDateEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(ev => (
              <div key={ev.id} onClick={() => openEditModal(ev)} style={{
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${ev.color}33`,
                background: ev.color + '0a',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{ev.title}</span>
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: 16 }}>
                  🕐 {ev.startTime} — {ev.endTime}
                </div>
                {ev.description && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: 4, marginLeft: 16 }}>{ev.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)',
            borderRadius: 20,
            border: '1px solid var(--border-color)',
            padding: 28,
            width: 440,
            maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: '1.1rem' }}>
              {editEvent ? '✏️ แก้ไข Event' : '📅 เพิ่ม Event ใหม่'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                placeholder="ชื่อ Event..."
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>เริ่ม</label>
                  <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>จบ</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>สี</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {EVENT_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      style={{
                        width: 28, height: 28, borderRadius: 8, background: c, cursor: 'pointer',
                        border: form.color === c ? '3px solid var(--text-main)' : '3px solid transparent',
                        transition: 'border 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
              <textarea
                placeholder="รายละเอียด..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                {editEvent && (
                  <button onClick={() => handleDelete(editEvent.id)} style={{
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
        </div>
      )}
    </div>
  );
}

function formatDateThai(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`;
}

const navBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-color)',
  borderRadius: 10,
  padding: '6px 12px',
  cursor: 'pointer',
  color: 'var(--text-main)',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-main)',
  color: 'var(--text-main)',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.5,
  marginBottom: 4,
  display: 'block',
};
