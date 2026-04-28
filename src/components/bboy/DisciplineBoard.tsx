import React, { useState, useEffect, useMemo } from 'react';

interface DisciplineData {
  checkins: Record<string, string[]>; // date -> completed habits
  streak: number;
  longestStreak: number;
}

const HABITS = [
  { id: 'dance', label: 'ซ้อมเต้น', emoji: '🕺', color: '#ef4444' },
  { id: 'workout', label: 'ออกกำลังกาย', emoji: '💪', color: '#3b82f6' },
  { id: 'stretch', label: 'ยืดเหยียด', emoji: '🧘', color: '#10b981' },
  { id: 'water', label: 'ดื่มน้ำ ≥ 2L', emoji: '💧', color: '#06b6d4' },
  { id: 'sleep', label: 'นอน ≥ 7 ชม.', emoji: '😴', color: '#8b5cf6' },
  { id: 'eat_clean', label: 'กินคลีน', emoji: '🥗', color: '#22c55e' },
];

const QUOTES = [
  '"The only way to be great is to practice every day." 🔥',
  '"Pain is temporary, but quitting lasts forever." 💪',
  '"Bboy ที่เก่ง ไม่ใช่คนที่มีพรสวรรค์ แต่คือคนที่ไม่เคยหยุดฝึก" 🕺',
  '"Consistency beats talent every single time." ⭐',
  '"ทำวันนี้ให้ดีที่สุด แล้วพรุ่งนี้จะดีขึ้นเอง" 🌟',
  '"Every master was once a disaster." 💯',
  '"ล้มแล้วลุก ล้มอีกก็ลุกอีก นั่นแหละ Bboy" 🔄',
  '"แค่ซ้อมทุกวัน อีก 1 ปีคุณจะไม่เชื่อตัวเอง" 📈',
];

export function DisciplineBoard() {
  const [data, setData] = useState<DisciplineData>({ checkins: {}, streak: 0, longestStreak: 0 });
  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch('/api/get-app-data?key=bboy_discipline')
      .then(r => r.json())
      .then(d => { if (d && d.checkins) setData(d); })
      .catch(() => {});
  }, []);

  const saveData = (updated: DisciplineData) => {
    setData(updated);
    fetch('/api/save-app-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'bboy_discipline', data: updated }) });
  };

  const toggleHabit = (habitId: string) => {
    const todayHabits = data.checkins[todayStr] || [];
    const newHabits = todayHabits.includes(habitId)
      ? todayHabits.filter(h => h !== habitId)
      : [...todayHabits, habitId];

    const newCheckins = { ...data.checkins, [todayStr]: newHabits };

    // Calculate streak
    let streak = 0;
    let d = new Date();
    while (true) {
      const ds = d.toISOString().slice(0, 10);
      const dayHabits = newCheckins[ds] || [];
      if (dayHabits.length >= 3) { // At least 3 habits to count as a day
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        // If today and haven't completed 3, don't break streak check yesterday
        if (ds === todayStr) {
          d.setDate(d.getDate() - 1);
          continue;
        }
        break;
      }
    }

    // Also check if today counts
    if ((newCheckins[todayStr] || []).length >= 3) {
      streak = Math.max(streak, 1);
    }

    const longestStreak = Math.max(data.longestStreak, streak);
    saveData({ checkins: newCheckins, streak, longestStreak });
  };

  const todayHabits = data.checkins[todayStr] || [];
  const todayProgress = Math.round((todayHabits.length / HABITS.length) * 100);

  // Heatmap — last 12 weeks (84 days)
  const heatmapDays = useMemo(() => {
    const days: { date: string; count: number; isToday: boolean }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const ds = d.toISOString().slice(0, 10);
      days.push({
        date: ds,
        count: (data.checkins[ds] || []).length,
        isToday: ds === todayStr,
      });
    }
    return days;
  }, [data.checkins, todayStr]);

  // Monthly stats
  const thisMonth = todayStr.slice(0, 7);
  const daysThisMonth = Object.keys(data.checkins).filter(d => d.startsWith(thisMonth) && data.checkins[d].length >= 3).length;
  const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const consistency = Math.round((daysThisMonth / totalDaysInMonth) * 100);

  const randomQuote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Quote Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #ef4444, #f97316, #f59e0b)',
          borderRadius: 20, padding: 28, color: '#fff',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 8 }}>💭 คำคมวันนี้</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontStyle: 'italic', lineHeight: 1.6 }}>
            {randomQuote}
          </div>
        </div>

        {/* Daily Check-in */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>📋 Check-in วันนี้</h3>
            <div style={{
              padding: '4px 14px', borderRadius: 20,
              background: todayProgress === 100 ? '#10b98122' : 'var(--bg-main)',
              color: todayProgress === 100 ? '#10b981' : 'var(--text-main)',
              fontSize: '0.8rem', fontWeight: 700,
            }}>
              {todayProgress === 100 ? '🎉 ครบแล้ว!' : `${todayHabits.length}/${HABITS.length}`}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 10, borderRadius: 5, background: 'var(--bg-main)',
            overflow: 'hidden', marginBottom: 20,
          }}>
            <div style={{
              height: '100%', borderRadius: 5,
              background: todayProgress === 100
                ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                : 'linear-gradient(135deg, #ef4444, #f97316)',
              width: `${todayProgress}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {HABITS.map(habit => {
              const isDone = todayHabits.includes(habit.id);
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 14,
                    border: `2px solid ${isDone ? habit.color : 'var(--border-color)'}`,
                    background: isDone ? habit.color + '15' : 'transparent',
                    cursor: 'pointer', color: 'var(--text-main)',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: isDone ? habit.color : 'transparent',
                    border: `2px solid ${isDone ? habit.color : 'var(--border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                    transition: 'all 0.2s ease',
                  }}>
                    {isDone ? '✓' : ''}
                  </div>
                  <div>
                    <div style={{ fontSize: '1rem' }}>{habit.emoji}</div>
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 600,
                      textDecoration: isDone ? 'line-through' : 'none',
                      opacity: isDone ? 0.6 : 1,
                    }}>{habit.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Heatmap */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '1rem' }}>
            🗓️ Contribution Heatmap (12 สัปดาห์)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gridTemplateRows: 'repeat(7, 1fr)',
            gap: 3,
            gridAutoFlow: 'column',
          }}>
            {heatmapDays.map((d, i) => {
              const intensity = d.count === 0 ? 0 : d.count <= 2 ? 1 : d.count <= 4 ? 2 : 3;
              const colors = ['var(--bg-main)', '#ef444433', '#ef444466', '#ef4444cc'];
              return (
                <div
                  key={i}
                  title={`${d.date}: ${d.count} habits`}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 4,
                    background: colors[intensity],
                    border: d.isToday ? '2px solid #f59e0b' : '1px solid transparent',
                    cursor: 'default',
                    minWidth: 12,
                    maxWidth: 24,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', opacity: 0.4, marginRight: 4 }}>น้อย</span>
            {['var(--bg-main)', '#ef444433', '#ef444466', '#ef4444cc'].map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
            ))}
            <span style={{ fontSize: '0.65rem', opacity: 0.4, marginLeft: 4 }}>มาก</span>
          </div>
        </div>
      </div>

      {/* Stats Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Streak */}
        <div style={{
          background: 'linear-gradient(135deg, #f97316, #ef4444)',
          borderRadius: 20, padding: 28, color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>🔥</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, marginTop: 8 }}>{data.streak}</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.8 }}>วัน Streak</div>
          <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: 8 }}>
            (ทำ ≥ 3 habits ถึงนับเป็น 1 วัน)
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 20,
        }}>
          <h4 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 700 }}>📊 สถิติ</h4>
          {[
            { label: '🔥 Streak ยาวสุด', value: `${data.longestStreak} วัน` },
            { label: '📅 วันนี้ทำได้', value: `${todayHabits.length}/${HABITS.length}` },
            { label: '📆 เดือนนี้', value: `${daysThisMonth} วัน` },
            { label: '📈 Consistency', value: `${consistency}%` },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: '0.82rem' }}>{s.label}</span>
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Level */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          border: '1px solid var(--border-color)', padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 4 }}>
            {data.streak >= 30 ? '👑' : data.streak >= 14 ? '⭐' : data.streak >= 7 ? '💎' : data.streak >= 3 ? '🔥' : '🌱'}
          </div>
          <div style={{ fontWeight: 800, fontSize: '1rem' }}>
            {data.streak >= 30 ? 'Bboy Legend'
              : data.streak >= 14 ? 'Consistent Grinder'
              : data.streak >= 7 ? 'On Fire'
              : data.streak >= 3 ? 'Getting Started'
              : 'Beginner'}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 4 }}>
            {data.streak >= 30 ? '30 วันติดต่อกัน! คุณเป็นตำนาน!' 
              : data.streak >= 14 ? 'ไปต่ออย่าหยุด! เกือบ 1 เดือนแล้ว'
              : data.streak >= 7 ? '1 สัปดาห์แล้ว! ยอดเยี่ยม!'
              : data.streak >= 3 ? 'เริ่มดีขึ้นแล้ว สู้ต่อ!'
              : 'เริ่มซ้อมเลย! ทำทุกวันให้เป็นนิสัย'}
          </div>
        </div>
      </div>
    </div>
  );
}
