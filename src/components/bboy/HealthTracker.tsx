import React, { useState, useEffect, useRef, useMemo } from 'react';

interface HealthEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  sleepHours: number;
  calories: number;
  waterLiters: number;
  mood: string;
  notes: string;
}

const MOODS = ['😃', '🙂', '😐', '😔', '😫'];

export function HealthTracker() {
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    weight: 0, sleepHours: 7, calories: 0, waterLiters: 2, mood: '🙂', notes: '',
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch('/api/get-app-data?key=bboy_health')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data); })
      .catch(() => {});
  }, []);

  const saveEntries = (updated: HealthEntry[]) => {
    setEntries(updated);
    fetch('/api/save-app-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'bboy_health', data: updated }) });
  };

  const handleSave = () => {
    const existing = entries.findIndex(e => e.date === form.date);
    if (existing >= 0) {
      saveEntries(entries.map((e, i) => i === existing ? { ...e, ...form } : e));
    } else {
      saveEntries([...entries, { id: Date.now().toString(), ...form }].sort((a, b) => a.date.localeCompare(b.date)));
    }
    setShowModal(false);
  };

  const deleteEntry = (id: string) => {
    saveEntries(entries.filter(e => e.id !== id));
  };

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || entries.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    if (sorted.length < 2) return;

    const drawLine = (values: number[], color: string, dashOffset?: number) => {
      const min = Math.min(...values) * 0.95;
      const max = Math.max(...values) * 1.05;
      const range = max - min || 1;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      if (dashOffset) ctx.setLineDash([5, 5]);
      else ctx.setLineDash([]);

      values.forEach((val, i) => {
        const x = 40 + (i / (values.length - 1)) * (w - 60);
        const y = h - 30 - ((val - min) / range) * (h - 60);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Dots
      values.forEach((val, i) => {
        const x = 40 + (i / (values.length - 1)) * (w - 60);
        const y = h - 30 - ((val - min) / range) * (h - 60);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const weights = sorted.map(e => e.weight).filter(w => w > 0);
    const sleeps = sorted.map(e => e.sleepHours).filter(s => s > 0);

    if (weights.length >= 2) drawLine(weights, '#ef4444');
    if (sleeps.length >= 2) drawLine(sleeps, '#3b82f6', 5);

    // Legend
    ctx.setLineDash([]);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(w - 160, 10, 12, 3);
    ctx.fillText('น้ำหนัก (kg)', w - 143, 15);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(w - 160, 25, 12, 3);
    ctx.fillText('ชั่วโมงนอน', w - 143, 30);
  }, [entries]);

  // Stats
  const recentEntries = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7), [entries]);
  const avgWeight = recentEntries.length > 0 ? (recentEntries.reduce((a, e) => a + e.weight, 0) / recentEntries.length).toFixed(1) : '—';
  const avgSleep = recentEntries.length > 0 ? (recentEntries.reduce((a, e) => a + e.sleepHours, 0) / recentEntries.length).toFixed(1) : '—';
  const avgWater = recentEntries.length > 0 ? (recentEntries.reduce((a, e) => a + e.waterLiters, 0) / recentEntries.length).toFixed(1) : '—';

  const todayEntry = entries.find(e => e.date === new Date().toISOString().slice(0, 10));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Chart */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>📈 Trend (30 วันล่าสุด)</h3>
            <button onClick={() => {
              setForm({
                date: new Date().toISOString().slice(0, 10),
                weight: todayEntry?.weight || 0,
                sleepHours: todayEntry?.sleepHours || 7,
                calories: todayEntry?.calories || 0,
                waterLiters: todayEntry?.waterLiters || 2,
                mood: todayEntry?.mood || '🙂',
                notes: todayEntry?.notes || '',
              });
              setShowModal(true);
            }} style={{
              padding: '8px 18px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
            }}>+ บันทึกวันนี้</button>
          </div>
          {entries.length < 2 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
              บันทึกข้อมูลอย่างน้อย 2 วันเพื่อดู trend
            </div>
          ) : (
            <canvas ref={canvasRef} style={{ width: '100%', height: 220 }} />
          )}
        </div>

        {/* History */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '1rem' }}>📋 ประวัติ</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14).map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                borderRadius: 12, border: '1px solid var(--border-color)',
                fontSize: '0.82rem',
              }}>
                <span style={{ fontWeight: 700, minWidth: 90 }}>{e.date}</span>
                <span>{e.mood}</span>
                <span style={{ color: '#ef4444' }}>⚖️ {e.weight}kg</span>
                <span style={{ color: '#3b82f6' }}>😴 {e.sleepHours}h</span>
                <span style={{ color: '#06b6d4' }}>💧 {e.waterLiters}L</span>
                {e.calories > 0 && <span style={{ color: '#f59e0b' }}>🔥 {e.calories}cal</span>}
                <button onClick={() => deleteEntry(e.id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  opacity: 0.2, fontSize: '0.75rem', color: 'var(--text-main)', marginLeft: 'auto',
                }}>🗑️</button>
              </div>
            ))}
            {entries.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, opacity: 0.3 }}>
                ยังไม่มีข้อมูล — กดปุ่มบันทึกวันนี้
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Today Status */}
        <div style={{
          background: todayEntry ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'linear-gradient(135deg, #6b7280, #4b5563)',
          borderRadius: 20, padding: 24, color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 4 }}>{todayEntry ? todayEntry.mood : '❓'}</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
            {todayEntry ? 'บันทึกวันนี้แล้ว ✅' : 'ยังไม่ได้บันทึกวันนี้'}
          </div>
        </div>

        {/* Weekly Averages */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 20,
        }}>
          <h4 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 700 }}>📊 ค่าเฉลี่ย 7 วัน</h4>
          {[
            { label: '⚖️ น้ำหนัก', value: `${avgWeight} kg`, color: '#ef4444' },
            { label: '😴 นอน', value: `${avgSleep} ชม.`, color: '#3b82f6' },
            { label: '💧 น้ำ', value: `${avgWater} ลิตร`, color: '#06b6d4' },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: '0.82rem' }}>{s.label}</span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Goals */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 20,
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700 }}>🎯 เป้าหมาย</h4>
          <div style={{ fontSize: '0.8rem', opacity: 0.5, lineHeight: 2 }}>
            <div>💧 น้ำ: ≥ 2 ลิตร/วัน</div>
            <div>😴 นอน: ≥ 7 ชม./วัน</div>
            <div>📝 บันทึกทุกวัน!</div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={modalStyle}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 700 }}>📊 บันทึกสุขภาพ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>วันที่</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>น้ำหนัก (kg)</label>
                  <input type="number" step="0.1" value={form.weight || ''} onChange={e => setForm({ ...form, weight: Number(e.target.value) })} placeholder="65.0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>ชั่วโมงนอน</label>
                  <input type="number" step="0.5" value={form.sleepHours} onChange={e => setForm({ ...form, sleepHours: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>แคลอรี่</label>
                  <input type="number" value={form.calories || ''} onChange={e => setForm({ ...form, calories: Number(e.target.value) })} placeholder="2000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>น้ำ (ลิตร)</label>
                  <input type="number" step="0.5" value={form.waterLiters} onChange={e => setForm({ ...form, waterLiters: Number(e.target.value) })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>อารมณ์</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {MOODS.map(m => (
                    <button key={m} onClick={() => setForm({ ...form, mood: m })} style={{
                      fontSize: '1.5rem', padding: '4px 10px', borderRadius: 10,
                      border: form.mood === m ? '3px solid var(--text-main)' : '3px solid transparent',
                      background: form.mood === m ? 'var(--bg-main)' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>{m}</button>
                  ))}
                </div>
              </div>
              <textarea placeholder="หมายเหตุ..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 };
const modalStyle: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-color)', padding: 28, width: 480, maxWidth: '90vw' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: 4, display: 'block' };
const cancelBtnStyle: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { padding: '8px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700 };
