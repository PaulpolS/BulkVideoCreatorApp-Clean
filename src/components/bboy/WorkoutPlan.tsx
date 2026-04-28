import React, { useState, useEffect } from 'react';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // e.g. "10" or "30sec"
  category: string;
  imageUrl: string;
  notes: string;
}

interface WorkoutDay {
  id: string;
  dayLabel: string;
  exercises: Exercise[];
}

interface Equipment {
  id: string;
  name: string;
  imageUrl: string; // base64 or uploaded path
  description: string;
}

const EXERCISE_CATS = ['Upper Body', 'Core', 'Lower Body', 'Flexibility', 'Balance', 'Cardio'];

export function WorkoutPlan() {
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [todayChecked, setTodayChecked] = useState<string[]>([]);
  const [showExModal, setShowExModal] = useState(false);
  const [targetDay, setTargetDay] = useState<string>('');
  const [editEx, setEditEx] = useState<Exercise | null>(null);
  const [exForm, setExForm] = useState({ name: '', sets: 3, reps: '10', category: 'Upper Body', notes: '' });
  const [showEqModal, setShowEqModal] = useState(false);
  const [eqForm, setEqForm] = useState({ name: '', description: '' });
  const [eqImagePreview, setEqImagePreview] = useState('');
  const [activeView, setActiveView] = useState<'plan' | 'equipment'>('plan');

  useEffect(() => {
    fetch('/api/get-app-data?key=bboy_workouts')
      .then(r => r.json())
      .then(data => {
        if (data && data.days) { setDays(data.days); setEquipment(data.equipment || []); setTodayChecked(data.todayChecked || []); }
        else if (Array.isArray(data) && data.length === 0) {
          // Init default days
          const defaults: WorkoutDay[] = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map((d, i) => ({
            id: `day-${i}`, dayLabel: d, exercises: [],
          }));
          setDays(defaults);
        }
      }).catch(() => {});
  }, []);

  const saveAll = (d: WorkoutDay[], eq: Equipment[], checked: string[]) => {
    setDays(d); setEquipment(eq); setTodayChecked(checked);
    fetch('/api/save-app-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'bboy_workouts', data: { days: d, equipment: eq, todayChecked: checked } }) });
  };

  const openAddEx = (dayId: string) => {
    setTargetDay(dayId); setEditEx(null);
    setExForm({ name: '', sets: 3, reps: '10', category: 'Upper Body', notes: '' });
    setShowExModal(true);
  };

  const openEditEx = (dayId: string, ex: Exercise) => {
    setTargetDay(dayId); setEditEx(ex);
    setExForm({ name: ex.name, sets: ex.sets, reps: ex.reps, category: ex.category, notes: ex.notes });
    setShowExModal(true);
  };

  const saveEx = () => {
    if (!exForm.name.trim()) return;
    const updatedDays = days.map(d => {
      if (d.id !== targetDay) return d;
      if (editEx) {
        return { ...d, exercises: d.exercises.map(ex => ex.id === editEx.id ? { ...ex, ...exForm } : ex) };
      } else {
        return { ...d, exercises: [...d.exercises, { id: Date.now().toString(), ...exForm, imageUrl: '' }] };
      }
    });
    saveAll(updatedDays, equipment, todayChecked);
    setShowExModal(false);
  };

  const deleteEx = (dayId: string, exId: string) => {
    const updatedDays = days.map(d => d.id === dayId ? { ...d, exercises: d.exercises.filter(ex => ex.id !== exId) } : d);
    saveAll(updatedDays, equipment, todayChecked);
    setShowExModal(false);
  };

  const toggleChecked = (exId: string) => {
    const newChecked = todayChecked.includes(exId) ? todayChecked.filter(id => id !== exId) : [...todayChecked, exId];
    saveAll(days, equipment, newChecked);
  };

  const handleEqImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEqImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveEquipment = () => {
    if (!eqForm.name.trim()) return;
    const newEq: Equipment = { id: Date.now().toString(), ...eqForm, imageUrl: eqImagePreview };
    const updatedEq = [...equipment, newEq];
    saveAll(days, updatedEq, todayChecked);
    setShowEqModal(false);
    setEqForm({ name: '', description: '' });
    setEqImagePreview('');
  };

  const deleteEquipment = (id: string) => {
    saveAll(days, equipment.filter(eq => eq.id !== id), todayChecked);
  };

  const todayDayName = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][new Date().getDay()];
  const todayPlan = days.find(d => d.dayLabel === todayDayName);
  const todayTotal = todayPlan?.exercises.length || 0;
  const todayDone = todayPlan?.exercises.filter(ex => todayChecked.includes(ex.id)).length || 0;

  return (
    <div>
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveView('plan')} style={{
          ...tabBtnStyle, background: activeView === 'plan' ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'var(--bg-card)', color: activeView === 'plan' ? '#fff' : 'var(--text-main)',
        }}>💪 แผนออกกำลังกาย</button>
        <button onClick={() => setActiveView('equipment')} style={{
          ...tabBtnStyle, background: activeView === 'equipment' ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'var(--bg-card)', color: activeView === 'equipment' ? '#fff' : 'var(--text-main)',
        }}>🏋️ เครื่องออกกำลังกาย ({equipment.length})</button>
      </div>

      {activeView === 'plan' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
          {/* Workout Plan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {days.map(day => {
              const isToday = day.dayLabel === todayDayName;
              return (
                <div key={day.id} style={{
                  background: 'var(--bg-card)', borderRadius: 16,
                  border: isToday ? '2px solid #ef4444' : '1px solid var(--border-color)',
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                      {isToday ? '🔥 ' : ''}{day.dayLabel}
                      {isToday && <span style={{ fontSize: '0.7rem', color: '#ef4444', marginLeft: 8 }}>วันนี้</span>}
                    </h4>
                    <button onClick={() => openAddEx(day.id)} style={{
                      padding: '4px 12px', borderRadius: 8, border: '1px dashed var(--border-color)',
                      background: 'transparent', cursor: 'pointer', color: 'var(--text-main)',
                      fontSize: '0.75rem', opacity: 0.5,
                    }}>+ เพิ่มท่า</button>
                  </div>
                  {day.exercises.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', opacity: 0.3, textAlign: 'center', padding: '8px 0' }}>— วันพัก —</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {day.exercises.map(ex => {
                        const isDone = todayChecked.includes(ex.id);
                        return (
                          <div key={ex.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                            borderRadius: 10, background: isDone ? '#10b98112' : 'var(--bg-main)',
                            border: '1px solid var(--border-color)', opacity: isDone ? 0.6 : 1,
                          }}>
                            {isToday && (
                              <button onClick={() => toggleChecked(ex.id)} style={{
                                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                border: `2px solid ${isDone ? '#10b981' : 'var(--border-color)'}`,
                                background: isDone ? '#10b981' : 'transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: '0.65rem',
                              }}>{isDone && '✓'}</button>
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', textDecoration: isDone ? 'line-through' : 'none' }}>{ex.name}</div>
                              <div style={{ fontSize: '0.72rem', opacity: 0.5 }}>
                                {ex.sets} sets × {ex.reps} · {ex.category}
                              </div>
                            </div>
                            <button onClick={() => openEditEx(day.id, ex)} style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              opacity: 0.3, fontSize: '0.75rem', color: 'var(--text-main)',
                            }}>✏️</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Today's Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              borderRadius: 20, padding: 24, color: '#fff', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: 4 }}>วันนี้ ({todayDayName})</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>
                {todayDone}/{todayTotal}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>ท่าที่ทำเสร็จ</div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.3)', marginTop: 12, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: '#fff',
                  width: `${todayTotal > 0 ? (todayDone / todayTotal * 100) : 0}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              {todayDone === todayTotal && todayTotal > 0 && (
                <div style={{ marginTop: 12, fontSize: '1.2rem' }}>🎉 ทำครบแล้ว!</div>
              )}
            </div>

            <div style={{
              background: 'var(--bg-card)', borderRadius: 20,
              border: '1px solid var(--border-color)', padding: 20,
            }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, opacity: 0.6 }}>💡 Tips</h4>
              <ul style={{ fontSize: '0.78rem', opacity: 0.5, paddingLeft: 16, lineHeight: 1.8, margin: 0 }}>
                <li>Warm up 10 นาทีก่อนทุกครั้ง</li>
                <li>ดื่มน้ำอย่างน้อย 500ml ระหว่างซ้อม</li>
                <li>Cool down + stretch 10 นาทีหลังซ้อม</li>
                <li>พักผ่อนให้เพียงพอ 7-8 ชม.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Equipment Gallery */
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => { setEqForm({ name: '', description: '' }); setEqImagePreview(''); setShowEqModal(true); }} style={{
              padding: '10px 22px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
            }}>+ เพิ่มเครื่อง</button>
          </div>
          {equipment.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, opacity: 0.3 }}>
              <span style={{ fontSize: '3rem' }}>🏋️</span>
              <p>ยังไม่มีเครื่องออกกำลังกาย — ถ่ายรูปแล้วอัพเข้ามาได้เลย</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
              {equipment.map(eq => (
                <div key={eq.id} style={{
                  borderRadius: 18, border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)', overflow: 'hidden',
                }}>
                  {eq.imageUrl && (
                    <img src={eq.imageUrl} alt={eq.name} style={{
                      width: '100%', height: 200, objectFit: 'cover',
                    }} />
                  )}
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{eq.name}</div>
                    {eq.description && <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{eq.description}</div>}
                    <button onClick={() => deleteEquipment(eq.id)} style={{
                      marginTop: 8, padding: '4px 12px', borderRadius: 8,
                      border: '1px solid #ef444444', background: 'transparent',
                      color: '#ef4444', cursor: 'pointer', fontSize: '0.72rem',
                    }}>🗑️ ลบ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exercise Modal */}
      {showExModal && (
        <div style={overlayStyle} onClick={() => setShowExModal(false)}>
          <div onClick={e => e.stopPropagation()} style={modalStyle}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 700 }}>{editEx ? '✏️ แก้ไขท่า' : '➕ เพิ่มท่าออกกำลังกาย'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input placeholder="ชื่อท่า..." value={exForm.name} onChange={e => setExForm({ ...exForm, name: e.target.value })} style={inputStyle} />
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Sets</label>
                  <input type="number" value={exForm.sets} onChange={e => setExForm({ ...exForm, sets: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Reps/Duration</label>
                  <input placeholder="10 or 30sec" value={exForm.reps} onChange={e => setExForm({ ...exForm, reps: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>หมวด</label>
                <select value={exForm.category} onChange={e => setExForm({ ...exForm, category: e.target.value })} style={inputStyle}>
                  {EXERCISE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <textarea placeholder="หมายเหตุ..." value={exForm.notes} onChange={e => setExForm({ ...exForm, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {editEx && <button onClick={() => deleteEx(targetDay, editEx.id)} style={deleteBtnStyle}>🗑️ ลบ</button>}
                <button onClick={() => setShowExModal(false)} style={cancelBtnStyle}>ยกเลิก</button>
                <button onClick={saveEx} style={saveBtnStyle}>💾 บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Modal */}
      {showEqModal && (
        <div style={overlayStyle} onClick={() => setShowEqModal(false)}>
          <div onClick={e => e.stopPropagation()} style={modalStyle}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 700 }}>🏋️ เพิ่มเครื่องออกกำลังกาย</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input placeholder="ชื่อเครื่อง..." value={eqForm.name} onChange={e => setEqForm({ ...eqForm, name: e.target.value })} style={inputStyle} />
              <textarea placeholder="คำอธิบาย..." value={eqForm.description} onChange={e => setEqForm({ ...eqForm, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              <div>
                <label style={labelStyle}>รูปภาพ</label>
                <input type="file" accept="image/*" onChange={handleEqImage} style={{ fontSize: '0.85rem' }} />
                {eqImagePreview && <img src={eqImagePreview} alt="preview" style={{ marginTop: 8, width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }} />}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowEqModal(false)} style={cancelBtnStyle}>ยกเลิก</button>
                <button onClick={saveEquipment} style={saveBtnStyle}>💾 บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tabBtnStyle: React.CSSProperties = { padding: '10px 20px', borderRadius: 12, border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 };
const modalStyle: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-color)', padding: 28, width: 440, maxWidth: '90vw' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: 4, display: 'block' };
const deleteBtnStyle: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600, marginRight: 'auto' };
const cancelBtnStyle: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { padding: '8px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff', cursor: 'pointer', fontWeight: 700 };
