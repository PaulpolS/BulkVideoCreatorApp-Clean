import React, { useState, useEffect, useMemo } from 'react';

interface TodoItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  dueDate: string;
  completed: boolean;
  createdAt: string;
}

type FilterMode = 'all' | 'today' | 'week' | 'month' | 'done';

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: '🔴 สูง', color: '#ef4444', bg: '#ef444418' },
  medium: { label: '🟡 กลาง', color: '#f59e0b', bg: '#f59e0b18' },
  low: { label: '🟢 ต่ำ', color: '#10b981', bg: '#10b98118' },
};

export function DiaryTodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as TodoItem['priority'], tags: '', dueDate: '' });

  useEffect(() => {
    fetch('/api/get-app-data?key=diary_todos')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTodos(data); })
      .catch(() => {});
  }, []);

  const saveTodos = (updated: TodoItem[]) => {
    setTodos(updated);
    fetch('/api/save-app-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'diary_todos', data: updated }),
    });
  };

  const handleAdd = () => {
    if (!form.title.trim()) return;
    const newTodo: TodoItem = {
      id: Date.now().toString(),
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      dueDate: form.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    saveTodos([newTodo, ...todos]);
    setForm({ title: '', description: '', priority: 'medium', tags: '', dueDate: '' });
    setShowForm(false);
  };

  const toggleComplete = (id: string) => {
    saveTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    saveTodos(todos.filter(t => t.id !== id));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const monthEndStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let result = [...todos];
    switch (filter) {
      case 'today': result = result.filter(t => t.dueDate === todayStr && !t.completed); break;
      case 'week': result = result.filter(t => t.dueDate >= todayStr && t.dueDate <= weekEnd && !t.completed); break;
      case 'month': result = result.filter(t => t.dueDate >= todayStr && t.dueDate <= monthEndStr && !t.completed); break;
      case 'done': result = result.filter(t => t.completed); break;
      default: result = result.filter(t => !t.completed);
    }
    return result.sort((a, b) => {
      const pOrder = { high: 0, medium: 1, low: 2 };
      return pOrder[a.priority] - pOrder[b.priority];
    });
  }, [todos, filter]);

  const totalActive = todos.filter(t => !t.completed).length;
  const totalDone = todos.filter(t => t.completed).length;
  const progress = todos.length > 0 ? Math.round((totalDone / todos.length) * 100) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
      {/* Main List */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-color)', padding: 24 }}>
        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-main)', borderRadius: 12, padding: 3, flexWrap: 'wrap' }}>
            {([['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'ประจำเดือน'], ['done', 'เสร็จแล้ว']] as [FilterMode, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: filter === id ? 700 : 500, fontSize: '0.8rem',
                background: filter === id ? 'var(--bg-card)' : 'transparent',
                color: 'var(--text-main)',
                boxShadow: filter === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>{label}</button>
            ))}
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{
            padding: '8px 18px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff',
            cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
          }}>
            {showForm ? '✕ ปิด' : '+ เพิ่มงาน'}
          </button>
        </div>

        {/* Add Form */}
        {showForm && (
          <div style={{
            padding: 20, borderRadius: 16, border: '1px solid var(--border-color)',
            background: 'var(--bg-main)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <input placeholder="ชื่องาน..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <textarea placeholder="รายละเอียด..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ความสำคัญ</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })} style={inputStyle}>
                  <option value="high">🔴 สูง</option>
                  <option value="medium">🟡 กลาง</option>
                  <option value="low">🟢 ต่ำ</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>กำหนดส่ง</label>
                <input 
                  type="date" 
                  value={form.dueDate} 
                  onChange={e => setForm({ ...form, dueDate: e.target.value })} 
                  onClick={e => { try { (e.target as any).showPicker(); } catch(err){} }}
                  style={{...inputStyle, cursor: 'pointer'}} 
                />
              </div>
            </div>
            <input placeholder="Tags (คั่นด้วย ,)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} style={inputStyle} />
            <button onClick={handleAdd} style={{
              padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff',
              fontWeight: 700, fontSize: '0.9rem',
            }}>✅ เพิ่มงาน</button>
          </div>
        )}

        {/* Todo Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, opacity: 0.3 }}>
              <span style={{ fontSize: '2rem' }}>🎯</span>
              <p style={{ margin: '8px 0 0' }}>ไม่มีงาน{filter === 'done' ? 'ที่เสร็จแล้ว' : ''}</p>
            </div>
          )}
          {filtered.map(todo => {
            const pc = PRIORITY_CONFIG[todo.priority];
            return (
              <div key={todo.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14,
                borderRadius: 14, border: '1px solid var(--border-color)',
                background: todo.completed ? 'transparent' : pc.bg,
                opacity: todo.completed ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}>
                <button onClick={() => toggleComplete(todo.id)} style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                  border: `2px solid ${todo.completed ? '#10b981' : pc.color}`,
                  background: todo.completed ? '#10b981' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.7rem',
                }}>
                  {todo.completed && '✓'}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: '0.9rem',
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    marginBottom: 2,
                  }}>{todo.title}</div>
                  {todo.description && (
                    <div style={{ fontSize: '0.78rem', opacity: 0.5, marginBottom: 4 }}>{todo.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6,
                      background: pc.color + '22', color: pc.color, fontWeight: 700,
                    }}>{pc.label}</span>
                    {todo.dueDate && (
                      <span style={{
                        fontSize: '0.65rem', opacity: 0.5,
                        color: todo.dueDate < todayStr && !todo.completed ? '#ef4444' : 'inherit',
                        fontWeight: todo.dueDate < todayStr && !todo.completed ? 700 : 400,
                      }}>📆 {todo.dueDate}</span>
                    )}
                    {todo.tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4,
                        background: 'var(--border-color)', opacity: 0.7,
                      }}>#{tag}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteTodo(todo.id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  opacity: 0.3, fontSize: '0.8rem', color: 'var(--text-main)', padding: 4,
                }}>🗑️</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Progress Card */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-color)',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: 4 }}>{progress}%</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: 16 }}>ความคืบหน้าทั้งหมด</div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, width: `${progress}%`,
              background: 'linear-gradient(135deg, #f59e0b, #10b981)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '0.8rem' }}>
            <span>⏳ ค้าง: {totalActive}</span>
            <span>✅ เสร็จ: {totalDone}</span>
          </div>
        </div>

        {/* Today's Quick Stats */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-color)',
          padding: 24,
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700 }}>📊 สรุปวันนี้</h4>
          {(['high', 'medium', 'low'] as const).map(p => {
            const count = todos.filter(t => t.priority === p && !t.completed).length;
            const pc = PRIORITY_CONFIG[p];
            return (
              <div key={p} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ fontSize: '0.8rem' }}>{pc.label}</span>
                <span style={{ fontWeight: 700, color: pc.color, fontSize: '0.9rem' }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Overdue Warning */}
        {todos.filter(t => t.dueDate && t.dueDate < todayStr && !t.completed).length > 0 && (
          <div style={{
            background: '#ef444412', borderRadius: 16, border: '1px solid #ef444433',
            padding: 16, textAlign: 'center',
          }}>
            <span style={{ fontSize: '1.3rem' }}>⚠️</span>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', marginTop: 4 }}>
              งานเลยกำหนด: {todos.filter(t => t.dueDate && t.dueDate < todayStr && !t.completed).length} รายการ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  border: '1px solid var(--border-color)', background: 'var(--bg-card)',
  color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: 4, display: 'block',
};
